// src/GlobalNetworkMap.js
import React, { useEffect, useState }  from 'react'; // Removed useCallback as it wasn't used directly here for setHoverInfo anymore
import DeckGL from '@deck.gl/react';
import BaseMap from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';

const MINIMAL_DARK_STYLE = {
  version: 8,
  name: "Minimal Dark Custom",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#0A0F14", 
      }
    }
  ]
};

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
      zIndex: 1000, // Ensure legend is above map but below tooltip
      fontFamily: 'monospace',
      border: '1px solid #204060'
    }}>
      <div><span style={{height: '10px', width: '10px', backgroundColor: 'rgba(255, 107, 35, 0.8)', borderRadius: '50%', display: 'inline-block', marginRight: '5px'}}></span> Miner Location (dot size indicates density)</div>
    </div>
  );
};


const GlobalNetworkMap = ({ locations }) => {
  const [worldOutlines, setWorldOutlines] = useState(null);

  useEffect(() => {
    fetch('/world_outlines.geojson') 
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok for world_outlines.geojson');
        }
        return response.json();
      })
      .then(data => setWorldOutlines(data))
      .catch(error => console.warn("Could not load world outlines GeoJSON:", error));
  }, []);

  const landOutlineLayer = React.useMemo(() => {
    if (!worldOutlines) return null;
    return new GeoJsonLayer({
      id: 'land-outline-layer',
      data: worldOutlines,
      stroked: true,
      filled: true,
      getFillColor: [20, 30, 40, 200], 
      getLineColor: [60, 100, 130, 200], 
      lineWidthMinPixels: 0.5,
      pickable: false, // Land outlines don't need to be interactive
    });
  }, [worldOutlines]);


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
      if (Array.isArray(point.position) && point.position.length === 2 && 
          typeof point.position[0] === 'number' && typeof point.position[1] === 'number' &&
          !isNaN(point.position[0]) && !isNaN(point.position[1])) {
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
      } else {
        // console.warn('Invalid point structure or lat/lon in GlobalNetworkMap:', point); // Optional: for debugging invalid points
      }
    });
    return Array.from(aggregation.values());
  }, [originalData]);

  const scatterplotLayer = React.useMemo(() => {
    if (!aggregatedData || aggregatedData.length === 0) return null;
    return new ScatterplotLayer({
      id: 'scatterplot-layer',
      data: aggregatedData,
      pickable: true,      // Enable picking for this layer
      autoHighlight: true, // Highlights the dot on hover (can be true or based on a color function)
      highlightColor: [255, 255, 255, 200], // Color for auto-highlight
      opacity: 0.9,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels', 
      radiusMinPixels: 2, 
      radiusMaxPixels: 40, 
      lineWidthMinPixels: 1,
      getPosition: d => d.position,
      getFillColor: [255, 107, 35, 220], 
      getLineColor: [255, 255, 255, 150], 
      getRadius: d => 2 + Math.sqrt(d.count) * 2.5, 
      updateTriggers: { // If any accessor depends on external state not in `data`, list it here. Not strictly needed for current setup.
          // getFillColor: [someExternalColorVar], 
      }
    });
  }, [aggregatedData]);


  const INITIAL_VIEW_STATE = {
    longitude: -0,
    latitude: 25,
    zoom: 1.3,
    pitch: 0,
    bearing: 0
  };

  if (!locations || locations.length === 0) {
    return <div className="no-data" style={{padding: "20px", textAlign: "center", height: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center'}}>No location data input.</div>;
  }
  // This check is now implicitly handled by scatterplotLayer being null if aggregatedData is empty
  // if (!aggregatedData || aggregatedData.length === 0) {
  //   return <div className="no-data" style={{padding: "20px", textAlign: "center"}}>Location data provided, but no valid points to display. Check lat/lon values.</div>;
  // }

  const layers = [
    landOutlineLayer,
    scatterplotLayer,
  ].filter(Boolean);

  const getTooltipContent = ({object}) => {
    if (!object) {
      return null;
    }
    const { city, country, count, uids } = object;
    let tooltipText = '';
    if (city && country) {
      tooltipText += `${city}, ${country}\n`;
    } else if (city) {
      tooltipText += `${city}\n`;
    } else if (country) {
      tooltipText += `${country}\n`;
    } else {
      tooltipText += `Unknown Location\n`;
    }
    tooltipText += `Miners: ${count}\n`;
    if (uids && uids.length > 0) {
      const uidsToShow = uids.slice(0, 3).join(', ');
      tooltipText += `UIDs: ${uidsToShow}`;
      if (uids.length > 3) {
        tooltipText += `, ... (${uids.length - 3} more)`;
      }
    }
    return {
      text: tooltipText,
      // style: { backgroundColor: 'black', color: 'white', fontSize: '12px', padding: '5px' } // Basic inline styling for tooltip
    };
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: "100%", background: '#0A0F14' }}>
      <div style={{
        position: 'absolute', top: '10px', left: '10px', color: '#A0D0F0',
        fontSize: '16px', fontFamily: 'monospace', zIndex: 1,
        backgroundColor: 'rgba(10, 16, 26, 0.7)', padding: '4px 8px', border: '1px solid #204060'
      }}>
        - Live Global Status -
      </div>

      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        // Only enable specific controller interactions if needed. For tooltips, Deck.gl handles mouse events.
        // If the map should be static (no pan/zoom by user), this is fine.
        // For hover to work, DeckGL needs to process pointer events.
        // controller={true} // Full control
        controller={{dragPan: true, dragRotate: true, scrollZoom: true, touchZoom: false, touchRotate: false, doubleClickZoom: true, keyboard: false}} // Keep map static but allow pointer events for hover
        layers={layers}
        getTooltip={getTooltipContent} // Use the function to generate tooltip content
        pickingRadius={5} // How close the pointer needs to be to an object to be considered a hover
        style={{ width: '100%', height: '100%', position: 'relative' }}

      >
        <BaseMap
          mapLib={maplibregl}
          mapStyle={MINIMAL_DARK_STYLE}
          reuseMaps
          preventStyleDiffing={true}
          dragPan={true}
          dragRotate={true}
          scrollZoom={true}
          touchZoom={false}
          touchRotate={false}
          doubleClickZoom={true}
          keyboard={false}
          attributionControl={false}
        />
      </DeckGL>
      <Legend />
    </div>
  );
};

export default React.memo(GlobalNetworkMap); // Memoize the component