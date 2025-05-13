// src/GlobalNetworkMap.js
import React, { useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { LineLayer } from '@deck.gl/layers';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const GlobalNetworkMap = ({ locations }) => {
  const [tooltip, setTooltip] = useState(null);

  const data = React.useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return locations.map(loc => ({
      position: [loc.lon, loc.lat], // Deck.gl expects [longitude, latitude]
      uid: loc.uid,
      city: loc.city,
      country: loc.country,
      message: `Miner UID: ${loc.uid}<br/>Location: ${loc.city || 'N/A'}, ${loc.country || 'N/A'}<br/>Coords: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`
    }));
  }, [locations]);

  const hexLayer = new HexagonLayer({
    id: 'hexagon-layer',
    data,
    pickable: true,
    extruded: true,
    radius: 200000, // Radius of hexagon bin in meters (adjust as needed)
    elevationScale: 4, // Multiplier for hexagon height (adjust as needed)
    getPosition: d => d.position,
    // Example colorRange (adjust to your preference)
    colorRange: [
      [1, 152, 189],
      [73, 227, 206],
      [216, 254, 181],
      [254, 237, 177],
      [254, 173, 84],
      [209, 55, 78]
    ],
    onHover: info => {
      if (info.object) {
        const { x, y, object } = info;
        // Create a list of UIDs in the hexbin
        const uidsInHex = object.points.map(p => p.uid).join(', ');
        const count = object.points.length;
        setTooltip({
          x,
          y,
          html: `<b>${count} Miner${count > 1 ? 's' : ''} in this area</b><br/>(UIDs: ${uidsInHex.substring(0, 100)}${uidsInHex.length > 100 ? '...' : ''})`
        });
      } else {
        setTooltip(null);
      }
    }
  });

  // Prepare data for LineLayer (all-to-all connections)
  // WARNING: This can be very performance intensive and visually cluttered for many points.
  // Consider alternative connection strategies for large datasets.
  const lineData = React.useMemo(() => {
    const lines = [];
    if (data.length > 1 && data.length < 50) { // Limit lines for performance/clarity
      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          lines.push({
            sourcePosition: data[i].position,
            targetPosition: data[j].position,
            message: `Connection: Miner ${data[i].uid} ↔ Miner ${data[j].uid}`
          });
        }
      }
    } else if (data.length >= 50) {
        console.warn("Too many nodes for full mesh connection display. Skipping line layer.");
    }
    return lines;
  }, [data]);

  const connectionLayer = new LineLayer({
    id: 'connection-layer',
    data: lineData,
    getSourcePosition: d => d.sourcePosition,
    getTargetPosition: d => d.targetPosition,
    getColor: [100, 100, 100, 50], // RGBA color (semi-transparent grey)
    getWidth: 1,
    pickable: true,
    onHover: info => {
      if (info.object) {
        const { x, y, object } = info;
        setTooltip({ x, y, html: object.message });
      } else if (!tooltip || (tooltip && !tooltip.html.includes("Miner") && !tooltip.html.includes("area"))) { // Don't clear hex tooltip
        // A bit complex logic to avoid flickering when moving between hex and line
        // Best to have separate tooltips or a more robust tooltip manager
      }
    }
  });

  const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 30, // Centered more on populated landmasses
    zoom: 1.5,
    pitch: 45, // For a 3D view of extruded hexagons
    bearing: 0
  };

  const getTooltip = ({ x, y, html }) => {
    if (!html) return null;
    return {
      html: `<div style="background: white; color: black; padding: 8px; border-radius: 4px; font-size: 0.9em; boxShadow: 0 2px 4px rgba(0,0,0,0.3); max-width: 250px;">${html}</div>`,
      style: {
        left: x,
        top: y,
        position: 'absolute', // deck.gl handles positioning
        pointerEvents: 'none', // Allow map interaction through tooltip
        zIndex: 1000,
      }
    };
  };


  if (data.length === 0 && locations && locations.length > 0) {
      return <div className="no-data">Location data found, but could not be processed for map. Check lat/lon values.</div>
  }
  if (!locations || locations.length === 0) {
    return <div className="no-data">No location data to display on map.</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px' }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[hexLayer, connectionLayer]}
        getTooltip={getTooltip} // Use Deck.gl's built-in tooltip handling
      >
        <Map mapLib={maplibregl} mapStyle={MAP_STYLE} />
      </DeckGL>
    </div>
  );
};

export default GlobalNetworkMap;