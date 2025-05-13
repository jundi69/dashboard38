// src/GlobalNetworkMap.js
import React from 'react';
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { ScatterplotLayer, LineLayer } from '@deck.gl/layers';

// A very dark, minimalist map style. Using CartoDB Dark Matter without labels.
// You can search for other "minimalist dark maplibre gl style json" if you want even simpler outlines.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
// For a very, very basic outline style like your example, you might need a custom style:
// const CUSTOM_MAP_STYLE = {
//   version: 8,
//   name: "Minimal Dark Outline",
//   sources: {
//     "world-boundaries": { // You'd need to find a suitable open vector tile source for boundaries
//       type: "vector",
//       // url: "pmtiles://path/to/your/boundaries.pmtiles" // Example if using PMTiles
//       // Or use a public source if available and suitable
//     }
//   },
//   layers: [
//     {
//       id: "background",
//       type: "background",
//       paint: { "background-color": "#0A101A" } // Very dark blue/black
//     },
//     // { // Layer for country outlines - source-layer and source would need to be correct
//     //   id: "country-outlines",
//     //   type: "line",
//     //   source: "world-boundaries",
//     //   "source-layer": "boundaries_countries", // This name depends on your vector tile source
//     //   paint: {
//     //     "line-color": "#3080C0", // Bluish outline
//     //     "line-width": 0.7
//     //   }
//     // }
//   ]
// };
// For now, we'll stick with Carto Dark Matter as it's easier to set up.


// --- Legend Component ---
const Legend = () => {
  // This is a simple legend. If you have a dynamic color scale,
  // you'd make this more representative of that scale.
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: '8px 12px',
      borderRadius: '4px',
      color: '#E0E0E0',
      fontSize: '12px',
      zIndex: 1,
      fontFamily: 'monospace',
    }}>
      <div><span style={{height: '10px', width: '10px', backgroundColor: 'rgba(255, 107, 35, 0.8)', borderRadius: '50%', display: 'inline-block', marginRight: '5px'}}></span> Miner Location</div>
      {/* Add more items if you have varying colors based on a metric */}
      {/* e.g., <div><span style={{color: '#FF0000'}}>■</span> High Activity</div> */}
      <div style={{marginTop: '5px', color: '#A0A0A0'}}>Lines show potential connections</div>
    </div>
  );
};


const GlobalNetworkMap = ({ locations }) => {
  const data = React.useMemo(() => {
    if (!locations || locations.length === 0) return [];
    return locations.map(loc => ({
      position: [loc.lon, loc.lat],
      uid: loc.uid,
      city: loc.city,
      country: loc.country,
      // --- OPTIONAL: Add a value if you want to color points by it ---
      // For example, let's assign a random value for demonstration of varying color
      // In a real scenario, this would come from your data.
      // value: Math.random() * 100
    }));
  }, [locations]);

  const scatterplotLayer = new ScatterplotLayer({
    id: 'scatterplot-layer',
    data,
    pickable: true, // Allow hovering for tooltips
    opacity: 0.8,
    stroked: true, // Add an outline to the dots
    filled: true,
    radiusScale: 6, // Adjust size of dots
    radiusMinPixels: 3,
    radiusMaxPixels: 8,
    lineWidthMinPixels: 1,
    getPosition: d => d.position,
    // --- UNIFORM COLOR (like your example image) ---
    getFillColor: [255, 107, 35, 200], // Orange, like the example (RGBA)
    getLineColor: [255, 255, 255, 100], // Faint white outline for dots

    // --- OPTIONAL: VARYING COLOR (if you add a 'value' to data points) ---
    // getFillColor: d => {
    //   if (d.value > 75) return [255, 0, 0, 200];       // Red (Hot)
    //   if (d.value > 50) return [255, 107, 35, 200];   // Orange
    //   if (d.value > 25) return [255, 215, 0, 200];   // Yellow
    //   return [135, 206, 250, 200];                   // Light Blue (Cool)
    // },
    // getLineColor: [0, 0, 0, 150], // Darker outline if colors vary
    onHover: info => {
      // setTooltip(info); // We'll implement a custom tooltip below if needed
      // For simplicity, we'll rely on the legend for now.
      // If you want tooltips:
      // const {x, y, object} = info;
      // if (object) {
      //   document.getElementById('deckgl-tooltip').innerHTML = `UID: ${object.uid}<br/>${object.city || 'N/A'}, ${object.country || 'N/A'}`;
      //   document.getElementById('deckgl-tooltip').style.left = `${x}px`;
      //   document.getElementById('deckgl-tooltip').style.top = `${y}px`;
      //   document.getElementById('deckgl-tooltip').style.display = 'block';
      // } else {
      //   document.getElementById('deckgl-tooltip').style.display = 'none';
      // }
    }
  });

  const lineData = React.useMemo(() => {
    const lines = [];
    // Limit connections for performance and visual clarity.
    // The example shows a dense mesh for few points.
    const maxPointsForFullMesh = 15; // Adjust as needed
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
      console.warn(`Too many nodes (${data.length}) for full mesh connection display. Skipping line layer or consider a different connection strategy.`);
      // You could implement a different strategy here, e.g., connect to nearest N, or to a central hub.
    }
    return lines;
  }, [data]);

  const connectionLayer = new LineLayer({
    id: 'connection-layer',
    data: lineData,
    getSourcePosition: d => d.sourcePosition,
    getTargetPosition: d => d.targetPosition,
    getColor: [200, 200, 200, 50], // Light, semi-transparent white/grey lines
    getWidth: 1,
    pickable: false, // Usually no need to interact with lines
  });

  const INITIAL_VIEW_STATE = {
    longitude: -20, // Center a bit more towards Atlantic for global
    latitude: 30,
    zoom: 1.5,    // Zoom out for a world view
    pitch: 0,     // Flat 2D view
    bearing: 0
  };

  if (data.length === 0 && locations && locations.length > 0) {
      return <div className="no-data">Location data found, but could not be processed for map. Check lat/lon values.</div>
  }
  if (!locations || locations.length === 0) {
    return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>No location data available.</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px', background: '#0A101A' /* Match map bg */ }}>
      {/* Title Overlay like in the example */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: '#A0D0F0', // Light blueish text
        fontSize: '16px',
        fontFamily: 'monospace', // Or a more techy font
        zIndex: 1, // Above the map
        backgroundColor: 'rgba(10, 16, 26, 0.7)', // Semi-transparent dark bg for text
        padding: '4px 8px',
        border: '1px solid #204060'
      }}>
        - Live Global Status -
      </div>

      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        // Limit map interactivity: allow pan and zoom, disable rotate.
        controller={{
          dragPan: true,
          dragRotate: false,
          scrollZoom: true,
          touchZoom: true,
          touchRotate: false,
          doubleClickZoom: true,
          keyboard: {panSpeed: 100, zoomSpeed: 1, rotateSpeed: 0} // Disable keyboard rotate
        }}
        layers={[scatterplotLayer, connectionLayer]}
        // getTooltip={({object}) => object && `UID: ${object.uid}\n${object.city || ''} ${object.country || ''}`} // Simple tooltip
      >
        <Map
          mapLib={maplibregl}
          mapStyle={MAP_STYLE}
          reuseMaps
          preventStyleDiffing={true}
          // Further restrict base map interaction if Deck.gl controller isn't enough
          // interactive={false} // This would make the base map completely non-interactive
        />
      </DeckGL>
      <Legend /> {/* Add the legend component */}
      {/* Optional: A div for tooltips if you re-enable them in onHover */}
      {/* <div id="deckgl-tooltip" style={{position: 'absolute', display: 'none', padding: '4px', background: 'rgba(0,0,0,0.8)', color: '#fff', zIndex: 2, pointerEvents: 'none'}}></div> */}
    </div>
  );
};

export default GlobalNetworkMap;