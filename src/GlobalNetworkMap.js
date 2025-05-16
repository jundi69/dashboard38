// src/GlobalNetworkMap.js
import React, { useEffect, useState }  from 'react';
import DeckGL from '@deck.gl/react';
import BaseMap from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers'; // LineLayer removed

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

// --- Legend Component (Updated) ---
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
      {/* Removed: <div style={{marginTop: '5px', color: '#A0A0A0'}}>Lines show connections</div> */}
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
    getFillColor: [20, 30, 40, 200], // Slightly transparent dark fill
    getLineColor: [60, 100, 130, 200], // Muted blueish-grey lines
    lineWidthMinPixels: 0.5,
    pickable: false,
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
    pickable: false, 
    opacity: 0.9,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels', // Ensure radius is in pixels
    radiusMinPixels: 2, 
    radiusMaxPixels: 40, // Max size for a dot
    lineWidthMinPixels: 1,
    getPosition: d => d.position,
    getFillColor: [255, 107, 35, 220], // Orange-red color for dots
    getLineColor: [255, 255, 255, 150], // Whiteish outline for dots
    // This function scales the radius of each dot based on the count of miners.
    // Base size of 2px, plus a value proportional to the square root of the count.
    // Adjust the multiplier (2.5 here) to change how rapidly dots grow with count.
    getRadius: d => 2 + Math.sqrt(d.count) * 2.5, 
  });

  // Removed lineData and connectionLayer logic

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

  // Updated layers array to remove connectionLayer
  const layers = [
    landOutlineLayer,
    scatterplotLayer,
    // connectionLayer removed
  ].filter(Boolean);

  return (
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
        controller={false} // Controller set to false, map is static
        layers={layers}
        style={{ cursor: 'default' }}
        // getTooltip={false} // Uncomment if you want to completely disable default Deck.gl tooltips
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
    </div>
  );
};

export default GlobalNetworkMap;
