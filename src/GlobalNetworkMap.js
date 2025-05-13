// src/GlobalNetworkMap.js
import React, { useState } from 'react';
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre'; // Use this import for react-map-gl v7+ with MapLibre
import maplibregl from 'maplibre-gl';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { LineLayer } from '@deck.gl/layers'; // You might want to remove this if focusing on the hexbin aesthetic

// Option 1: A very dark base map style
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
// Option 2: If you want to try a completely blank style (might require custom MapLibre style JSON)
// const MAP_STYLE = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: {'background-color': '#000000' }}] };


const GlobalNetworkMap = ({ locations }) => {
  const [tooltip, setTooltip] = useState(null);

  const data = React.useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return locations.map(loc => ({
      position: [loc.lon, loc.lat],
      uid: loc.uid,
      city: loc.city,
      country: loc.country,
    }));
  }, [locations]);

  const hexLayer = new HexagonLayer({
    id: 'hexagon-layer',
    data,
    pickable: true,
    // --- Styling for 2D hexbins like the example ---
    extruded: false, // Make it 2D
    stroked: true,   // Add outlines to hexagons
    lineWidthMinPixels: 1,
    getLineColor: [40, 40, 40, 200], // Dark outline color for hexagons
    // --- End Styling for 2D ---
    radius: 150000, // Radius of hexagon bin in meters (adjust for world view vs. regional view)
                    // For a world map, you might need a larger radius, e.g., 200000 or 300000
    coverage: 0.9,  // How much space hexagons take up relative to their radius
    // Example colorRange inspired by your image (adjust to your preference)
    // Goes from low density (blue/purple) to high density (orange/red)
    colorRange: [
      [77, 100, 169],  // Dark Blue/Purple (low density)
      [108, 88, 171], // Purple
      [160, 81, 166], // Magenta/Pink
      [210, 84, 130], // Pink/Reddish
      [248, 111, 107],// Coral/Orange
      [255, 69, 58]   // Bright Red (high density)
    ],
    getPosition: d => d.position,
    onHover: info => {
      if (info.object) {
        const { x, y, object } = info;
        const uidsInHex = object.points.map(p => p.uid).join(', ');
        const count = object.points.length;
        setTooltip({
          x,
          y,
          html: `<b>${count} Miner${count > 1 ? 's' : ''} in this area</b><br/>(Approx. UIDs: ${uidsInHex.substring(0, 100)}${uidsInHex.length > 100 ? '...' : ''})`
        });
      } else {
        setTooltip(null);
      }
    }
  });

  // Optional: You might want to disable or simplify the LineLayer if the focus is the hexbin aesthetic
  const lineData = React.useMemo(() => {
    const lines = [];
    if (data.length > 1 && data.length < 30) { // Further reduced limit for clarity
      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          lines.push({
            sourcePosition: data[i].position,
            targetPosition: data[j].position,
          });
        }
      }
    }
    return lines;
  }, [data]);

  const connectionLayer = new LineLayer({
    id: 'connection-layer',
    data: lineData,
    getSourcePosition: d => d.sourcePosition,
    getTargetPosition: d => d.targetPosition,
    getColor: [150, 150, 150, 30], // Very faint lines
    getWidth: 0.5,
    pickable: false, // Probably don't need tooltips for these if hexbins are primary
  });

  const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 25, // Centered for a world view
    zoom: 1.2,   // Zoom out for a world view
    pitch: 0,    // Set to 0 for a 2D top-down view
    bearing: 0
  };

  const getTooltipCallback = ({ x, y, object }) => {
    if (!object || !tooltip || !tooltip.html) return null; // Check if tooltip state has html

    // Check if the tooltip is for the hexagon layer based on its content
    if (tooltip.html.includes("Miner")) {
        return {
            html: `<div style="background: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 0.9em; boxShadow: 0 2px 4px rgba(0,0,0,0.5); max-width: 250px; border: 1px solid #555;">${tooltip.html}</div>`,
            style: {
                left: tooltip.x,
                top: tooltip.y,
                position: 'absolute',
                pointerEvents: 'none',
                zIndex: 1000,
            }
        };
    }
    return null; // Don't show tooltip for other layers if not intended
  };


  if (data.length === 0 && locations && locations.length > 0) {
      return <div className="no-data">Location data found, but could not be processed for map. Check lat/lon values.</div>
  }
  if (!locations || locations.length === 0) {
    return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>No location data to display on map. Ensure backend is providing valid lat/lon.</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px', background: '#111' /* Dark background for the map div itself */ }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[hexLayer, connectionLayer]} // You can remove connectionLayer if not needed
        getTooltip={getTooltipCallback}
      >
        <Map mapLib={maplibregl} mapStyle={MAP_STYLE} reuseMaps preventStyleDiffing={true} />
      </DeckGL>
    </div>
  );
};

export default GlobalNetworkMap;