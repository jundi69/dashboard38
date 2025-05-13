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
      <div><span style={{height: '10px', width: '10px', backgroundColor: 'rgba(255, 107, 35, 0.8)', borderRadius: '50%', display: 'inline-block', marginRight: '5px'}}></span> Miner Location</div>
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


  const data = React.useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return locations.map(loc => ({
      position: [loc.lon, loc.lat],
      uid: loc.uid,
      city: loc.city,
      country: loc.country,
    }));
  }, [locations]);

  const scatterplotLayer = new ScatterplotLayer({
    id: 'scatterplot-layer',
    data,
    pickable: false, // Disabled picking for simplicity
    opacity: 0.9,
    stroked: true,
    filled: true,
    radiusScale: 6,
    radiusMinPixels: 3,
    radiusMaxPixels: 7,
    lineWidthMinPixels: 1,
    getPosition: d => d.position,
    getFillColor: [255, 107, 35, 220], // Orange, slightly more opaque
    getLineColor: [255, 255, 255, 150], // White outline
  });

  const lineData = React.useMemo(() => {
    const lines = [];
    const maxPointsForFullMesh = 25; // Increased slightly, adjust as needed
    if (data.length > 1 && data.length <= maxPointsForFullMesh) {
      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          lines.push({
            sourcePosition: data[i].position,
            targetPosition: data[j].position,
          });
        }
      }
    } else if (data.length > maxPointsForFullMesh) {
      // console.warn(`Too many nodes (${data.length}) for full mesh connection display.`);
    }
    // console.log("Generated lineData count:", lines.length); // For debugging
    return lines;
  }, [data]);

  const connectionLayer = new LineLayer({
    id: 'connection-layer',
    data: lineData,
    getSourcePosition: d => d.sourcePosition,
    getTargetPosition: d => d.targetPosition,
    getColor: [200, 200, 200, 100], // Brighter, more opaque lines: RGBA (was 50 alpha)
    getWidth: 1.2,                   // Slightly thicker lines (was 1 or 0.5)
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


  if (data.length === 0 && locations && locations.length > 0) {
      return <div className="no-data">Location data found, but could not be processed. Check lat/lon.</div>
  }
  if (!locations || locations.length === 0) {
    return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>No location data available.</div>;
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