// src/GlobalNetworkMap.js
import React, { useEffect, useState } from 'react';
import DeckGL from '@deck.gl/react';
import BaseMap from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { ScatterplotLayer, LineLayer, GeoJsonLayer } from '@deck.gl/layers';

// Option A: Truly minimal style (just a dark background)
const MINIMAL_DARK_STYLE = {
  version: 8,
  name: "Minimal Dark Custom",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#0A0F14", // Very dark blue/black
      }
    }
  ]
};

// --- Legend Component (same as before) ---
const Legend = () => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '10px',
      backgroundColor: 'rgba(10, 16, 26, 0.7)',
      padding: '8px 12px',
      borderRadius: '4px',
      color: '#E0E0E0',
      fontSize: '12px',
      zIndex: 1,
      fontFamily: 'monospace',
      border: '1px solid #204060'
    }}>
      <div><span style={{height: '10px', width: '10px', backgroundColor: 'rgba(255, 107, 35, 0.8)', borderRadius: '50%', display: 'inline-block', marginRight: '5px'}}></span> Miner Location (dot size indicates density)</div>
      <div style={{marginTop: '5px', color: '#A0A0A0'}}>Lines show connections</div>
    </div>
  );
};


const GlobalNetworkMap = ({ locations }) => {
  const [worldOutlines, setWorldOutlines] = useState(null);
  useEffect(() => {
    fetch('/world_outlines.geojson') // ADJUST FILENAME if different
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok for world_outlines.geojson');
        }
        return response.json();
      })
      .then(data => setWorldOutlines(data))
      .catch(error => console.warn("Could not load world outlines GeoJSON:", error));
  }, []);

  const landOutlineLayer = worldOutlines && new GeoJsonLayer({
    id: 'land-outline-layer',
    data: worldOutlines,
    stroked: true,
    filled: true,
    getFillColor: [20, 30, 40, 200],
    getLineColor: [60, 100, 130, 200],
    lineWidthMinPixels: 0.5,
    pickable: false, // Ensure not pickable
  });

  const originalData = React.useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return locations.map(loc => ({
      position: [loc.lon, loc.lat],
      uid: loc.uid,
      city: loc.city,
      country: loc.country,
    }));
  }, [locations]);
  
  const aggregatedData = React.useMemo(() => {
    if (!originalData || originalData.length === 0) return [];
    const aggregation = new Map();
    originalData.forEach(point => {
      if (Array.isArray(point.position) && point.position.length === 2 && !point.position.some(isNaN)) {
        const key = `${point.position[0].toFixed(5)},${point.position[1].toFixed(5)}`;
        if (!aggregation.has(key)) {
          aggregation.set(key, {
            position: point.position,
            count: 0,
            uids: [],
            city: point.city,
            country: point.country,
          });
        }
        const aggPoint = aggregation.get(key);
        aggPoint.count += 1;
        aggPoint.uids.push(point.uid);
      }
    });
    return Array.from(aggregation.values());
  }, [originalData]);

  const scatterplotLayer = new ScatterplotLayer({
    id: 'scatterplot-layer',
    data: aggregatedData,
    pickable: false, // FIX 1: Ensure this is false if no hover interaction is desired on points
    opacity: 0.9,
    stroked: true,
    filled: true,
    // FIX 3: Adjust radius scaling and max pixels
    radiusMinPixels: 2, // Smallest dots are 2px (adjust as needed)
    radiusMaxPixels: 40, // Increased from 20 to allow larger dots for high counts
    lineWidthMinPixels: 1,
    getPosition: d => d.position,
    getFillColor: [255, 107, 35, 220],
    getLineColor: [255, 255, 255, 150],
    // FIX 3: Modified getRadius for better scaling.
    // This example: base size 2px, then sqrt(count) * 2.5. Tune constants as needed.
    // e.g., count=1  -> 2 + 1*2.5 = 4.5px
    //       count=100 -> 2 + 10*2.5 = 27px (will be < radiusMaxPixels)
    getRadius: d => 2 + Math.sqrt(d.count) * 2.5,
    
    // FIX 1: Removed onHover handler to prevent hand cursor.
    // If tooltips on points were desired, 'pickable' would need to be true,
    // and the hand cursor might be standard.
    // onHover: ({object, x, y}) => { ... }
  });

  const lineData = React.useMemo(() => {
    const lines = [];
    if (originalData && originalData.length > 1) {
      // FIX 2: Removed the maxPointsForMesh limit to connect all locations.
      // This creates a full mesh. For very large N, this can be dense.
      for (let i = 0; i < originalData.length; i++) {
        for (let j = i + 1; j < originalData.length; j++) {
          const source = originalData[i];
          const target = originalData[j];
          // Ensure points and their positions are valid before creating a line
          if (source && source.position && Array.isArray(source.position) && source.position.length === 2 && !source.position.some(isNaN) &&
              target && target.position && Array.isArray(target.position) && target.position.length === 2 && !target.position.some(isNaN)) {
            lines.push({
              sourcePosition: source.position,
              targetPosition: target.position,
            });
          }
        }
      }
    }
    return lines;
  }, [originalData]);

  const connectionLayer = new LineLayer({
    id: 'connection-layer',
    data: lineData,
    getSourcePosition: d => d.sourcePosition,
    getTargetPosition: d => d.targetPosition,
    getColor: [220, 220, 220, 120],
    getWidth: 1.5,
    widthUnits: 'pixels',
    pickable: false, // Ensure not pickable
  });

  const INITIAL_VIEW_STATE = {
    longitude: -0,
    latitude: 25,
    zoom: 1.3,
    pitch: 0,
    bearing: 0
  };

  if (!locations || locations.length === 0) {
    return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>No location data input.</div>;
  }
  if (!aggregatedData || aggregatedData.length === 0) {
    return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>Location data provided, but no valid points to display. Check lat/lon values.</div>;
  }

  const layers = [
    landOutlineLayer,
    scatterplotLayer,
    connectionLayer
  ].filter(Boolean);

  return (
    // FIX 1: Added cursor: 'default' to the wrapper div as an additional measure.
    <div style={{ position: 'relative', width: '100%', height: '500px', background: '#0A0F14', cursor: 'default' }}>
      <div style={{
        position: 'absolute', top: '10px', left: '10px', color: '#A0D0F0',
        fontSize: '16px', fontFamily: 'monospace', zIndex: 1,
        backgroundColor: 'rgba(10, 16, 26, 0.7)', padding: '4px 8px', border: '1px solid #204060'
      }}>
        - Live Global Status -
      </div>

      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={false} 
        layers={layers}
        style={{ cursor: 'default' }} // This was already here and is good
        // getTooltip={false} // Consider uncommenting if you want to disable Deck.gl's default tooltip handling entirely
      >
        <BaseMap
          mapLib={maplibregl}
          mapStyle={MINIMAL_DARK_STYLE}
          reuseMaps
          preventStyleDiffing={true}
          dragPan={false}
          dragRotate={false}
          scrollZoom={false}
          touchZoom={false}
          touchRotate={false}
          doubleClickZoom={false}
          keyboard={false}
          attributionControl={false}
        />
      </DeckGL>
      <Legend />
      {/* The tooltip div for scatterplot points is removed as onHover is removed.
          If you re-enable onHover for scatterplot points, you'll need a tooltip element like this:
      <div id="deckgl-tooltip" style={{
          position: 'absolute', 
          display: 'none', // Controlled by onHover
          pointerEvents: 'none', // Important
          zIndex: 10, // Above map layers
          background: 'rgba(0,0,0,0.8)', 
          color: 'white', 
          padding: '5px', 
          borderRadius: '3px',
          fontSize: '12px'
      }}></div>
      */}
    </div>
  );
};

export default GlobalNetworkMap;
