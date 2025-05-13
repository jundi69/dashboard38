// src/GlobalNetworkMap.js
import React, { useEffect, useState } from 'react'; // Added useState, useEffect
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { ScatterplotLayer, LineLayer, GeoJsonLayer } from '@deck.gl/layers'; // Added GeoJsonLayer

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
  // --- For Option B: GeoJSON based land outlines ---
  const [worldOutlines, setWorldOutlines] = useState(null);
  useEffect(() => {
    // You need to find a suitable world boundaries GeoJSON file and place it in your public folder
    // Example: 'world-countries-sans-antarctica.geojson'
    // Many sources online, search for "world countries geojson"
    // For this example, I'll assume you have a file named 'world_outlines.geojson' in your /public directory.
    // If you don't have one, the land outlines won't appear.
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
    filled: true, // Fill the landmasses slightly
    getFillColor: [20, 30, 40, 200], // Very dark, slightly opaque fill for land
    getLineColor: [60, 100, 130, 200], // Bluish outline for countries
    lineWidthMinPixels: 0.5,
    pickable: false,
  });
  // --- End Option B ---

  const originalData = React.useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return locations.map(loc => ({
      position: [loc.lon, loc.lat],
      uid: loc.uid,
      city: loc.city,
      country: loc.country,
    }));
  }, [locations]);
  
  // This 'aggregatedData' is for the scatterplot dots to show density at a point
  const aggregatedData = React.useMemo(() => {
    if (!originalData || originalData.length === 0) return [];
  
    const aggregation = new Map(); // Use a Map for easy keying by "lon,lat"
  
    originalData.forEach(point => {
      // Ensure position is valid before creating a key
      if (Array.isArray(point.position) && point.position.length === 2 && !point.position.some(isNaN)) {
        const key = `${point.position[0].toFixed(5)},${point.position[1].toFixed(5)}`; // Key by lon,lat (rounded)
        if (!aggregation.has(key)) {
          aggregation.set(key, {
            position: point.position,
            count: 0,
            uids: [],
            // Keep first city/country for tooltip, or combine them
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
    data: aggregatedData, // USE AGGREGATED DATA HERE
    pickable: false, // Set to true if you want tooltips for aggregated points
    opacity: 0.9,
    stroked: true,
    filled: true,
    // radiusScale: 6, // Can be dynamic based on count too
    radiusMinPixels: 3,
    radiusMaxPixels: 20, // Allow larger dots for high counts
    lineWidthMinPixels: 1,
    getPosition: d => d.position,
    getFillColor: [255, 107, 35, 220],
    getLineColor: [255, 255, 255, 150],
    getRadius: d => 2 + Math.sqrt(d.count) * 3, // Vary radius by count (sqrt for less extreme scaling)
    // Optional: onHover for tooltips showing count and UIDs
    onHover: ({object, x, y}) => {
      const el = document.getElementById('deckgl-tooltip'); // You'd need a tooltip div
      if (object && el) {
        el.style.display = 'block';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.innerHTML = `Location: ${object.city || 'N/A'}, ${object.country || 'N/A'}<br/>Miners: ${object.count}<br/>UIDs: ${object.uids.slice(0,5).join(', ')}${object.uids.length > 5 ? '...' : ''}`;
      } else if (el) {
        el.style.display = 'none';
      }
    }
  });

  const lineData = React.useMemo(() => {
    const lines = [];
    if (originalData && originalData.length > 1) { // Use originalData here
      const maxPointsForMesh = 30;
      if (originalData.length <= maxPointsForMesh) {
        for (let i = 0; i < originalData.length; i++) {
          for (let j = i + 1; j < originalData.length; j++) {
            if (Array.isArray(originalData[i].position) && originalData[i].position.length === 2 &&
                Array.isArray(originalData[j].position) && originalData[j].position.length === 2 &&
                !originalData[i].position.some(isNaN) && !originalData[j].position.some(isNaN) ) {
              lines.push({
                sourcePosition: originalData[i].position,
                targetPosition: originalData[j].position,
              });
            }
          }
        }
      }
    }
    return lines;
  }, [originalData]);

  const connectionLayer = new LineLayer({
    id: 'connection-layer',
    data: lineData, // Ensure this is receiving the generated lines
    getSourcePosition: d => d.sourcePosition,
    getTargetPosition: d => d.targetPosition,
    getColor: [220, 220, 220, 120], // Brighter, slightly more opaque: (was [200,200,200,100])
    getWidth: 1.5,                   // Slightly thicker (was 1.2)
    widthUnits: 'pixels',            // Ensure width is in pixels
    pickable: false,
  });

  const INITIAL_VIEW_STATE = {
    longitude: -0,
    latitude: 25,
    zoom: 1.3,
    pitch: 0,
    bearing: 0
  };

  // For debugging:
  // useEffect(() => {
  //   console.log("Locations for map:", locations);
  //   console.log("Processed data for layers:", data);
  //   console.log("Line data for connections:", lineData);
  // }, [locations, data, lineData]);


  if (!locations || locations.length === 0) {
    return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>No location data input.</div>;
  }
  if (!aggregatedData || aggregatedData.length === 0) {
    // This implies locations were provided, but processing (e.g., due to invalid lat/lon) resulted in no valid points.
    return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>Location data provided, but no valid points to display. Check lat/lon values.</div>;
  }

  const layers = [
    landOutlineLayer, // Will be null if GeoJSON doesn't load
    scatterplotLayer,
    connectionLayer
  ].filter(Boolean); // Filter out null layers

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px', background: '#0A0F14' }}>
      <div style={{
        position: 'absolute', top: '10px', left: '10px', color: '#A0D0F0',
        fontSize: '16px', fontFamily: 'monospace', zIndex: 1,
        backgroundColor: 'rgba(10, 16, 26, 0.7)', padding: '4px 8px', border: '1px solid #204060'
      }}>
        - Live Global Status -
      </div>

      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={false} // <<< COMPLETELY DISABLE DECKGL CONTROLLER FOR NO INTERACTION
        layers={layers}
        style={{ cursor: 'default' }}
        // getTooltip={false} // Disable tooltips
      >
        <Map
          mapLib={maplibregl}
          mapStyle={MINIMAL_DARK_STYLE} // Using the truly minimal style
          reuseMaps
          preventStyleDiffing={true}
          // --- Disable all base map interactions ---
          dragPan={false}
          dragRotate={false}
          scrollZoom={false}
          touchZoom={false}
          touchRotate={false}
          doubleClickZoom={false}
          keyboard={false}
          attributionControl={false} // Hide MapLibre attribution
        />
      </DeckGL>
      <Legend />
    </div>
  );
};

export default GlobalNetworkMap;