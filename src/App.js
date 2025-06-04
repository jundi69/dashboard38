// src/App.js
import React, { useState, useEffect, useCallback, Fragment } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  // AreaChart, // Not used in current context, can remove if not needed elsewhere
  // Area,
} from "recharts";
import Select from 'react-select';
import "./styles.css";
import axios from "axios";
import 'maplibre-gl/dist/maplibre-gl.css';
import GlobalNetworkMap from './GlobalNetworkMap';

const API_BASE_URL = process.env.REACT_APP_FASTAPI_URL || "http://localhost:8000";

// Format time helper (can be kept for tooltips if time is still shown)
// const formatTime = (timeStr) => {
//   if (!timeStr) return '';
//   const date = new Date(timeStr);
//   return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// };

// Helper function to calculate average scores (already provided, ensure it's here)
const calculateAverageScores = (scoresObject) => {
  if (!scoresObject || Object.keys(scoresObject).length === 0) {
    return { avgTrainScore: 0, avgAllReduceScore: 0, avgTotalScore: 0, validatorCount: 0 };
  }
  let totalTrain = 0;
  let totalAllReduce = 0;
  let totalTotal = 0;
  const validatorUids = Object.keys(scoresObject);
  const count = validatorUids.length;

  validatorUids.forEach(valUid => {
    totalTrain += scoresObject[valUid]?.train_score || 0;
    totalAllReduce += scoresObject[valUid]?.all_reduce_score || 0;
    totalTotal += scoresObject[valUid]?.total_score || 0;
  });

  return {
    avgTrainScore: count > 0 ? totalTrain / count : 0,
    avgAllReduceScore: count > 0 ? totalAllReduce / count : 0,
    avgTotalScore: count > 0 ? totalTotal / count : 0,
    validatorCount: count
  };
};

// Helper function for heatmap color (already provided, ensure it's here)
const getScoreColor = (score) => {
  if (score === null || score === undefined || isNaN(score)) return '#333944'; // Darker grey for N/A, ensure text is light
  if (score >= 0.9) return 'rgba(76, 175, 80, 0.7)';  // Greenish
  if (score >= 0.75) return 'rgba(255, 235, 59, 0.6)'; // Yellowish (more transparent for light text)
  if (score >= 0.5) return 'rgba(255, 152, 0, 0.6)'; // Orangeish (more transparent)
  return 'rgba(244, 67, 54, 0.7)'; // Reddish
};
const getTextColorForScore = (score) => {
    // If score is low or N/A and background is dark, use light text. Otherwise, use dark text.
    if (score === null || score === undefined || isNaN(score) || score < 0.6) return '#e0e0e0';
    return '#1a1a1a'; // Dark text for lighter backgrounds
}

const formatFullDate = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return date.toLocaleString();
};

// Tooltip formatter for inner_step charts
const stepTooltipLabelFormatter = (label, payload) => {
  if (payload && payload.length > 0) {
    const point = payload[0].payload; // Access the full data point
    // return `Step: ${label}, Epoch: ${point.epoch}, Time: ${formatTime(point.time)}`;
    return `Step: ${label}${point.epoch !== undefined ? `, Epoch: ${point.epoch}` : ''}${point.time ? `, Time: ${formatFullDate(point.time)}` : ''}`;
  }
  return `Step: ${label}`;
};

const CustomChartTooltip = ({ active, payload, label, labelFormatterName }) => { // Added labelFormatterName
  if (active && payload && payload.length) {
    const MAX_ITEMS_TO_SHOW = 5;
    const displayedPayload = payload.slice(0, MAX_ITEMS_TO_SHOW);

    let formattedLabel = String(label); // Default to string version of label

    // Custom label formatting based on context
    if (labelFormatterName === 'globalStepEpoch') { // For Global Overview Loss/Perplexity
        if (payload[0] && payload[0].payload) {
            const point = payload[0].payload;
            formattedLabel = `Step: ${label}${point.epoch !== undefined ? `, Epoch: ${point.epoch}` : ''}`;
        } else {
            formattedLabel = `Step: ${label}`;
        }
    } else if (labelFormatterName === 'minerExplorerLoss') { // For Miner Explorer Loss
         if (payload[0] && payload[0].payload) {
            const point = payload[0].payload;
            formattedLabel = `Step: ${label}${point.epoch !== undefined ? `, Epoch: ${point.epoch}` : ''}${point.time ? ` (${new Date(point.time).toLocaleTimeString()})` : ''}`;
        } else {
            formattedLabel = `Step: ${label}`;
        }
    } else if (labelFormatterName === 'minerExplorerIncentive') { // For Miner Explorer Incentive (label is unixTime)
        if (typeof label === 'number') {
             formattedLabel = new Date(label).toLocaleString();
        }
    }
    // Add more conditions for other charts if needed

    return (
      <div className="recharts-custom-tooltip">
        <p className="recharts-custom-tooltip-label">{formattedLabel}</p>
        <ul className="recharts-custom-tooltip-item-list">
          {displayedPayload.map((entry, index) => (
            <li key={`tooltip-item-${index}`} className="recharts-custom-tooltip-item" style={{ color: entry.color }}>
              {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toFixed(4) : String(entry.value)}`}
            </li>
          ))}
          {payload.length > MAX_ITEMS_TO_SHOW && (
            <li className="recharts-custom-tooltip-item" style={{ color: '#9098a5', marginTop: '5px' }}>
              {`... and ${payload.length - MAX_ITEMS_TO_SHOW} more`}
            </li>
          )}
        </ul>
      </div>
    );
  }
  return null;
};


const MINER_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F",
  "#FFBB28", "#FF8042", "#0088FE", "#A3A1FB", "#D4A1FB",
  "#4CAF50", "#F44336", "#E91E63", "#9C27B0", "#3F51B5",
  "#2196F3", "#00BCD4", "#009688", "#CDDC39", "#FFEB3B",
];


export default function App() {
  const [initialMinersLoaded, setInitialMinersLoaded] = useState(false); // New state
  const [activeTab, setActiveTab] = useState("global");
  const [selectedMiners, setSelectedMiners] = useState([]); 
  const [loading, setLoading] = useState({
    global: false,
    miners: false,
    minerData: {},
    allreduce: false,
    locations: false,
  });
  const [error, setError] = useState({
    global: null,
    miners: null,
    minerData: {},
    allreduce: null,
    locations: null,
  });

  const [globalData, setGlobalData] = useState({
    all_miner_losses: {},
    all_miner_perplexities: {},
    global_max_epoch_series: [],
    global_average_training_rate_series: [],
    global_total_bandwidth_series: [],
    active_miners_count_series: [],
    active_miners_current: 0,
  });

  const [miners, setMiners] = useState([]);
  const [minerData, setMinerData] = useState({});
  const [allReduceOperations, setAllReduceOperations] = useState([]);
  const [expandedOpKey, setExpandedOpKey] = useState(null);
  const [minerLocations, setMinerLocations] = useState([]);

  const [heatmapScoreType, setHeatmapScoreType] = useState('total_score');
  const [expandedMinerScores, setExpandedMinerScores] = useState({}); // { minerUid: true/false }

  const fetchGlobalMetrics = useCallback(async () => {
    setLoading(prev => ({ ...prev, global: true }));
    setError(prev => ({ ...prev, global: null }));
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/global`);

      setGlobalData({
        all_miner_losses: response.data.all_miner_losses || {},
        all_miner_perplexities: response.data.all_miner_perplexities || {},
        global_max_epoch_series: response.data.global_max_epoch_series || [],
        global_average_training_rate_series: response.data.global_average_training_rate_series || [],
        global_total_bandwidth_series: response.data.global_total_bandwidth_series || [],
        active_miners_count_series: response.data.active_miners_count_series || [],
        active_miners_current: response.data.active_miners_current || 0,
      });
    } catch (err) {
      console.error("Error fetching global metrics:", err);
      setError(prev => ({ ...prev, global: "No data currently available. Please try again later." }));
      setGlobalData({
        all_miner_losses: {},
        all_miner_perplexities: {},
        global_max_epoch_series: [],
        global_average_training_rate_series: [],
        global_total_bandwidth_series: [],
        active_miners_count_series: [],
        active_miners_current: 0,
      });
    } finally {
      setLoading(prev => ({ ...prev, global: false }));
    }
  }, []);

  const fetchMiners = useCallback(async () => {
    setLoading(prev => ({ ...prev, miners: true }));
    setError(prev => ({ ...prev, miners: null }));
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/miners`);
      const minerOptions = Array.isArray(response.data) ? response.data.map(uid => ({
        value: uid.toString(), // react-select expects a 'value'
        label: `Miner ${uid}`   // react-select expects a 'label'
      })) : [];
      setMiners(minerOptions);
    } catch (err) {
      console.error("Error fetching miners:", err);
      setError(prev => ({ ...prev, miners: "No data currently available. Please try again later." }));
      setMiners([]);
    } finally {
      setLoading(prev => ({ ...prev, miners: false }));
    }
  }, []);

  const fetchMinerData = useCallback(async (uid) => {
    if (!uid) return;

    setLoading(prev => ({ ...prev, minerData: { ...prev.minerData, [uid]: true } }));
    setError(prev => ({ ...prev, minerData: { ...prev.minerData, [uid]: null } }));
    
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/miner/${uid}`);
      setMinerData(prev => ({ ...prev, [uid]: response.data }));
    } catch (err) {
      console.error(`Error fetching data for miner ${uid}:`, err);
      setError(prev => ({ ...prev, minerData: { ...prev.minerData, [uid]: "No data available for this miner." } }));
      setMinerData(prev => ({ ...prev, [uid]: null })); // Ensure it's null on error
    } finally {
      setLoading(prev => ({ ...prev, minerData: { ...prev.minerData, [uid]: false } }));
    }
  }, []);

  const getOpKey = (op) => `${op?.operation_id}-${op?.epoch}`;

  const fetchAllReduceOperations = useCallback(async () => {
    setExpandedOpKey(null);
    setLoading(prev => ({ ...prev, allreduce: true }));
    setError(prev => ({ ...prev, allreduce: null }));
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/allreduce`);
      setAllReduceOperations(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error fetching AllReduce operations:", err);
      setError(prev => ({ ...prev, allreduce: "No data currently available. Please try again later." }));
      setAllReduceOperations([]);
    } finally {
      setLoading(prev => ({ ...prev, allreduce: false }));
    }
  }, []);
  
  const fetchMinerLocations = useCallback(async () => {
    setLoading(prev => ({ ...prev, locations: true }));
    setError(prev => ({ ...prev, locations: null }));
    try {
      const response = await axios.get(`${API_BASE_URL}/locations/miners`);
      const validLocations = Array.isArray(response.data)
        ? response.data.filter(loc =>
            typeof loc.lat === 'number' && typeof loc.lon === 'number' &&
            !isNaN(loc.lat) && !isNaN(loc.lon)
          )
        : [];
      setMinerLocations(validLocations);
    } catch (err) {
      console.error("Error fetching miner locations:", err);
      setError(prev => ({ ...prev, locations: "Could not load miner locations." }));
      setMinerLocations([]);
    } finally {
      setLoading(prev => ({ ...prev, locations: false }));
    }
  }, []);

    const fetchMinersAndSetTop10 = useCallback(async () => {
    setLoading(prev => ({ ...prev, miners: true, initialMinersLoading: true })); // Optional: separate loading state
    setError(prev => ({ ...prev, miners: null }));
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/miners`);
      const allMinerUids = Array.isArray(response.data) ? response.data.map(uid => uid.toString()) : [];
      
      const minerOptions = allMinerUids.map(uid => ({ value: uid, label: `Miner ${uid}` }));
      setMiners(minerOptions);

      if (allMinerUids.length === 0) {
        setSelectedMiners([]);
        setInitialMinersLoaded(true); // Mark as loaded even if empty
        setLoading(prev => ({ ...prev, miners: false, initialMinersLoading: false }));
        return;
      }

      // N+1 fetch for incentives (consider backend optimization)
      const minersWithIncentive = await Promise.all(
        allMinerUids.map(async (uid) => {
          try {
            const detailResponse = await axios.get(`${API_BASE_URL}/metrics/miner/${uid}?include_scores=false&include_training=false&include_resources=false`);
            return { uid, incentive: detailResponse.data?.metagraph?.incentive || 0 };
          } catch (e) { return { uid, incentive: 0 }; }
        })
      );

      minersWithIncentive.sort((a, b) => b.incentive - a.incentive);
      const top10Uids = minersWithIncentive.slice(0, 10).map(m => m.uid);
      
      setSelectedMiners(top10Uids); // This will trigger the other useEffect
      setInitialMinersLoaded(true);

    } catch (err) {
      console.error("Error fetching and processing miners for top 10:", err);
      setError(prev => ({ ...prev, miners: "Failed to load initial miner data." }));
      setMiners([]);
      setSelectedMiners([]);
      setInitialMinersLoaded(true); // Still mark as loaded to prevent retries
    } finally {
      setLoading(prev => ({ ...prev, miners: false, initialMinersLoading: false }));
    }
  }, []); // Dependencies: API_BASE_URL (if not constant), setLoading, setError, setMiners, setSelectedMiners, setInitialMinersLoaded

  // Effect for Global Tab
  useEffect(() => {
    if (activeTab === "global") {
      fetchGlobalMetrics();
      fetchMinerLocations();
    }
  }, [activeTab, fetchGlobalMetrics, fetchMinerLocations]);

  // Effect for AllReduce Tab
  useEffect(() => {
    if (activeTab === "allreduce") {
      fetchAllReduceOperations();
    }
  }, [activeTab, fetchAllReduceOperations]);

  // EFFECT 1 (for Miners Tab): Fetch initial list and set top 10 selected.
  useEffect(() => {
    if (activeTab === "miners" && !initialMinersLoaded) {
      fetchMinersAndSetTop10();
    }
  }, [activeTab, initialMinersLoaded, fetchMinersAndSetTop10]);


  // EFFECT 2 (for Miners Tab): Fetch data FOR the selectedMiners array.
  useEffect(() => {
    // Only proceed if the tab is 'miners' AND the initial loading of the miner list/top10 is complete.
    if (activeTab === "miners" && initialMinersLoaded) {
      if (selectedMiners.length > 0) {
        selectedMiners.forEach(uid => {
          // Fetch if not currently loading for this UID, AND
          // (data for this UID doesn't exist OR there was a previous error for this UID)
          if (!loading.minerData[uid] && (!minerData[uid] || error.minerData[uid])) {
            fetchMinerData(uid);
          }
        });

        // Cleanup: Remove data for miners that are no longer in selectedMiners
        const currentSelectedUIDs = new Set(selectedMiners.map(String)); // Ensure UIDs are strings for comparison
        setMinerData(prevMinerData => {
          const nextMinerData = { ...prevMinerData };
          Object.keys(nextMinerData).forEach(uidKey => { // uidKey from Object.keys() is a string
            if (!currentSelectedUIDs.has(uidKey)) {
              delete nextMinerData[uidKey];
            }
          });
          return nextMinerData;
        });
      } else {
        // If no miners are selected (e.g., user cleared selection), clear all detailed miner data.
        setMinerData({});
      }
    }
  }, [activeTab, selectedMiners, fetchMinerData, loading.minerData, error.minerData, initialMinersLoaded]);

  const handleReactSelectChange = (selectedOptions) => {
    setSelectedMiners(selectedOptions ? selectedOptions.map(option => option.value) : []);
  };

  const latestTotalBandwidth = globalData?.global_total_bandwidth_series && globalData.global_total_bandwidth_series.length > 0
    ? globalData.global_total_bandwidth_series[globalData.global_total_bandwidth_series.length - 1]?.value?.toFixed(2)
    : "0";

  const latestAvgTrainingRate = globalData?.global_average_training_rate_series && globalData.global_average_training_rate_series.length > 0
    ? globalData.global_average_training_rate_series[globalData.global_average_training_rate_series.length - 1]?.value?.toFixed(0)
    : "0";
  
  const activeMinersCurrentCount = globalData?.active_miners_current || "0";

  const toggleMinerScoreExpansion = (minerUid) => {
    setExpandedMinerScores(prev => ({ ...prev, [minerUid]: !prev[minerUid] }));
  };

  const allValidatorUIDs = React.useMemo(() => {
    const uids = new Set();
    selectedMiners.forEach(minerUid => {
      const mData = minerData[minerUid];
      if (mData && mData.scores) {
        Object.keys(mData.scores).forEach(valUid => uids.add(valUid));
      }
    });
    return Array.from(uids).sort((a, b) => parseInt(a) - parseInt(b)); // Sort them numerically
  }, [selectedMiners, minerData]);
    
  const currentOuterStep = globalData?.global_max_epoch_series && globalData.global_max_epoch_series.length > 0
    ? globalData.global_max_epoch_series[globalData.global_max_epoch_series.length - 1]?.value
    : "0";


  return (
    <div className="App">
      <div className="header">
        <h1>Distributed Training</h1>
        <p>Communally Training LLMs</p>
        <div className="tabs">
          <button
            className={activeTab === "global" ? "active" : ""}
            onClick={() => setActiveTab("global")}
          >
            Global Overview
          </button>
          <button
            className={activeTab === "miners" ? "active" : ""}
            onClick={() => setActiveTab("miners")}
          >
            Miner Explorer
          </button>
          <button
            className={activeTab === "allreduce" ? "active" : ""}
            onClick={() => setActiveTab("allreduce")}
          >
            AllReduce Operations
          </button>
        </div>
      </div>

      <div className="content">
        {activeTab === "global" && (
          <div className="global-view">
            <h2>Global Training Overview</h2>
            <div className="map-and-stats-row">
              <div className="map-column">
                {loading.locations ? (
                  <div className="loading" style={{ textAlign: 'center', padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map data...</div>
                ) : error.locations ? (
                  <div className="error-message" style={{ textAlign: 'center', padding: '20px' }}>{error.locations}</div>
                ) : minerLocations.length > 0 ? (
                  <GlobalNetworkMap locations={minerLocations} />
                ) : (
                  <div className="no-data" style={{ textAlign: 'center', padding: '20px', height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A202C', color: '#A0AEC0' }}>
                    No miner location data.
                  </div>
                )}
              </div>

              <div className="stats-column">
                <div className="stat-overview-card">
                  <div className="stat-icon bandwidth-icon">📶</div>
                  <div className="stat-content">
                    <h3>Global Bandwidth (Total)</h3>
                    <p className="stat-value">
                      {latestTotalBandwidth !== "0" ? `${latestTotalBandwidth} MB/s` : "No data"}
                    </p>
                  </div>
                </div>
                <div className="stat-overview-card">
                  <div className="stat-icon tokens-icon">🚀</div>
                  <div className="stat-content">
                    <h3>Global Training Rate (Avg)</h3>
                    <p className="stat-value">
                      {latestAvgTrainingRate !== "0" ? `${latestAvgTrainingRate} tok/s` : "No data"}
                    </p>
                  </div>
                </div>
                <div className="stat-overview-card">
                  <div className="stat-icon miners-icon">👨‍💻</div>
                  <div className="stat-content">
                    <h3>Active Miners</h3>
                    <p className="stat-value">
                      {activeMinersCurrentCount}
                    </p>
                  </div>
                </div>
                {/* New Stat Box for Outer Step */}
                <div className="stat-overview-card">
                  <div className="stat-icon epoch-icon">🔄</div> {/* You might want a different icon */}
                  <div className="stat-content">
                    <h3>Outer Step (Epoch)</h3>
                    <p className="stat-value">
                      {currentOuterStep}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {loading.global ? (
              <div className="loading" style={{ marginTop: '20px'}}>Loading global metrics...</div>
            ) : error.global ? (
              <div className="error-message" style={{ marginTop: '20px'}}>{error.global}</div>
            ) : (
              <div className="charts-row">
                <div className="chart-container half-width">
                  <h3>Loss</h3>
                  {globalData?.all_miner_losses && Object.keys(globalData.all_miner_losses).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 5 }}> {/* Adjusted right margin for YAxis labels */}
                        <CartesianGrid strokeDasharray="3 3" />
                        {/* X-axis is now inner_step */}
                        <XAxis
                          dataKey="time" // Key change: Use 'time' field from your chartData objects
                          tickFormatter={(timestamp) => {
                            // Format timestamp for display (e.g., "HH:mm" or "MMM DD")
                            try {
                              return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              // Or for date: new Date(timestamp).toLocaleDateString();
                            } catch (e) {
                              return timestamp; // Fallback
                            }
                          }}
                          // type="number" // If timestamps are converted to UNIX ms
                          // domain={['dataMin', 'dataMax']} // Usually fine for time
                          // Ensure other necessary props like stroke, tickLine, etc., are preserved.
                        />
                        <YAxis domain={['auto', 'auto']} /> {/* Let Y-axis auto-scale */}
                        {/* <Tooltip
                          labelFormatter={stepTooltipLabelFormatter} // Use custom formatter
                          formatter={(value) => value.toFixed(4)} // Format loss value */}
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend />
                        {Object.entries(globalData.all_miner_losses).map(([minerUid, lossData], index) => (
                          lossData && lossData.length > 0 && (
                            <Line
                              key={`loss-${minerUid}`}
                              type="monotone"
                              data={lossData} // Each miner gets their own data array
                              dataKey="value" // Y-axis value
                              name={`UID ${minerUid}`}
                              stroke={MINER_COLORS[index % MINER_COLORS.length]}
                              strokeWidth={1.5}
                              dot={false}
                              activeDot={{ r: 5 }}
                              isAnimationActive={true} // Optional: disable animation for performance
                            />
                          )
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data">No miner loss data</div>
                  )}
                </div>

                <div className="chart-container half-width">
                  {/* Removed Outer Step from title */}
                  <h3>Perplexity</h3>
                  {globalData?.all_miner_perplexities && Object.keys(globalData.all_miner_perplexities).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="time" // Key change: Use 'time' field from your chartData objects
                          tickFormatter={(timestamp) => {
                            // Format timestamp for display (e.g., "HH:mm" or "MMM DD")
                            try {
                              return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              // Or for date: new Date(timestamp).toLocaleDateString();
                            } catch (e) {
                              return timestamp; // Fallback
                            }
                          }}
                          // type="number" // If timestamps are converted to UNIX ms
                          // domain={['dataMin', 'dataMax']} // Usually fine for time
                          // Ensure other necessary props like stroke, tickLine, etc., are preserved.
                        />
                        <YAxis domain={['auto', 'auto']} />
                        {/* <Tooltip
                          labelFormatter={stepTooltipLabelFormatter}
                          formatter={(value) => value.toFixed(2)} // Format perplexity */}
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend />
                        {Object.entries(globalData.all_miner_perplexities).map(([minerUid, perplexityData], index) => (
                          perplexityData && perplexityData.length > 0 && (
                            <Line
                              key={`perplexity-${minerUid}`}
                              type="monotone"
                              data={perplexityData}
                              dataKey="value"
                              name={`UID ${minerUid}`}
                              stroke={MINER_COLORS[index % MINER_COLORS.length]}
                              strokeWidth={1.5}
                              dot={false}
                              activeDot={{ r: 5 }}
                              isAnimationActive={true}
                            />
                          )
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data">No miner perplexity data</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === "miners" && (
          <div className="miner-explorer">
            <h2>Miner Explorer</h2>

            {/* Section 1: Miner Selection Dropdown (react-select) */}
            {/* Purpose: Allow users to choose one or more miners for comparison. */}
            {/* Status: Looks mostly correct in your implementation. */}
            {loading.miners ? (
              <div className="loading">Loading miners list...</div>
            ) : error.miners ? (
              <div className="error-message">{error.miners}</div>
            ) : miners.length > 0 ? (
              <div className="miner-select" style={{ marginBottom: '25px' }}>
                <label className="select-label" htmlFor="miner-multiselect" style={{ display: 'block', marginBottom: '8px' }}>
                  Select Miner UIDs to Compare
                </label>
                <Select
                  id="miner-multiselect"
                  isMulti
                  options={miners} // `miners` state should be [{value, label}, ...]
                  className="miner-select-dropdown"
                  classNamePrefix="react-select"
                  value={miners.filter(option => selectedMiners.includes(option.value))}
                  onChange={handleReactSelectChange}
                  placeholder="Search and select miners..."
                  isLoading={loading.miners} // Loading state for the dropdown options themselves
                  isDisabled={loading.miners || miners.length === 0}
                  noOptionsMessage={() => error.miners ? error.miners : "No miners found"}
                  styles={{ /* Your dark theme styles - these look good */ }}
                />
                {/* This error message is redundant if noOptionsMessage is handled by react-select */}
                {/* Consider removing if react-select's noOptionsMessage covers it well enough */}
                {/* error.miners && !loading.miners && miners.length === 0 && (
                  <div className="error-message" style={{marginTop: '10px'}}>{error.miners}</div>
                )*/}
              </div>
            ) : (
              <div className="no-data">No miners available to select.</div> // Message if miner list is empty after loading
            )}

            {/* Section 2: Prompt to Select Miners (if list is loaded but nothing chosen) */}
            {/* Purpose: Guide the user if they haven't selected any miners yet. */}
            {/* Status: Correct. */}
            {selectedMiners.length === 0 && !loading.miners && miners.length > 0 && (
              <div className="no-miner-selected" style={{ marginTop: '20px' }}>
                <p>Select one or more miners to view detailed metrics.</p>
              </div>
            )}

            {/* Section 3: Main Content Area (when miners ARE selected) */}
            {/* Purpose: Display all comparative views for the chosen miners. */}
            {/* Status: This is where the main restructuring needs to be confirmed. */}
            {selectedMiners.length > 0 && (
              <> {/* Main Fragment for selected miners content */}

                {/* Section 3.1: (Proposal 3) Miner Comparison Summary Table with Expandable Rows */}
                {/* Purpose: Provide a high-level summary of key metrics for each selected miner, with an option to drill down. */}
                {/* Status: Your implementation of this table looks correct. */}
                <div className="data-section-container" >
                  <h3>Miner Comparison Summary</h3>
                  <table className="scores-table main-comparison-table">
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>Miner UID</th>
                        <th>Stake (TAO)</th>
                        <th>Trust</th>
                        <th>Consensus</th>
                        <th>Incentive</th>
                        <th>Avg Total Score</th>
                        <th>Avg Train Score</th>
                        <th>Avg AllReduce Score</th>
                        <th>Validators Scored By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMiners.map((uid) => {
                        const mData = minerData[uid];
                        // Loading state for this specific miner's row
                        if (loading.minerData[uid]) {
                          return (
                            <tr key={`summary-loading-${uid}`}>
                              <td>{uid}</td>
                              <td colSpan="8" style={{ textAlign: 'center' }}>Loading data...</td>
                            </tr>
                          );
                        }
                        // Error state for this specific miner's row
                        if (error.minerData[uid] || !mData) {
                          return (
                            <tr key={`summary-error-${uid}`}>
                              <td>{uid}</td>
                              <td colSpan="8" style={{ textAlign: 'center', color: '#ffcccc' }}>
                                {error.minerData[uid] || "No data available"}
                              </td>
                            </tr>
                          );
                        }
                        const avgScores = calculateAverageScores(mData.scores);
                        return (
                          <Fragment key={`summary-frag-${uid}`}>
                            <tr className={expandedMinerScores[uid] ? 'expanded-row-header' : ''}>
                              <td style={{ display: 'flex', alignItems: 'center' }}>
                                <button
                                  onClick={() => toggleMinerScoreExpansion(uid)}
                                  className="expand-button"
                                  style={{ marginRight: '10px', minWidth: '20px' }}
                                  aria-expanded={expandedMinerScores[uid]}
                                >
                                  {expandedMinerScores[uid] ? '−' : '+'}
                                </button>
                                {uid}
                              </td>
                              <td>{mData.metagraph?.stake?.toFixed(2) || 'N/A'}</td>
                              <td>{mData.metagraph?.trust?.toFixed(4) || 'N/A'}</td>
                              <td>{mData.metagraph?.consensus?.toFixed(4) || 'N/A'}</td>
                              <td>{mData.metagraph?.incentive?.toFixed(5) || 'N/A'}</td>
                              <td>{avgScores.avgTotalScore.toFixed(4)}</td>
                              <td>{avgScores.avgTrainScore.toFixed(4)}</td>
                              <td>{avgScores.avgAllReduceScore.toFixed(4)}</td>
                              <td>{avgScores.validatorCount}</td>
                            </tr>
                            {/* Expanded content for this row */}
                            {expandedMinerScores[uid] && (
                              <tr key={`details-${uid}`} className="expanded-row-content">
                                <td colSpan="9">
                                  <div className="validator-details-container" style={{ padding: '15px', backgroundColor: '#101010' }}>
                                    <h5 style={{ marginTop: 0, marginBottom: '10px', color: '#e0e0e0' }}>Scores for Miner {uid} by Validator:</h5>
                                    {mData.scores && Object.keys(mData.scores).length > 0 ? (
                                      <table className="validator-details-table" style={{ fontSize: '0.9em', width: '100%' }}>
                                        <thead>
                                          <tr>
                                            <th>Validator UID</th>
                                            <th>Total Score</th>
                                            <th>Train Score</th>
                                            <th>AllReduce Score</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {Object.entries(mData.scores).sort(([, a], [, b]) => (b.total_score || 0) - (a.total_score || 0)).map(([valUid, scores]) => (
                                            <tr key={`valscore-${uid}-${valUid}`}>
                                              <td>{valUid}</td>
                                              <td>{(scores.total_score || 0).toFixed(4)}</td>
                                              <td>{(scores.train_score || 0).toFixed(4)}</td>
                                              <td>{(scores.all_reduce_score || 0).toFixed(4)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : (
                                      <div className="no-data">No detailed validator scores for this miner.</div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Section 3.2: (Proposal 2) Heatmap Controls and Table */}
                {/* Purpose: Provide a matrix view of a selected score type across selected miners and all their validators. */}
                {/* Status: Your implementation of this also looks correct. */}
                <div className="data-section-container">
                  <div className="heatmap-controls" style={{ margin: '20px 0 10px 0', padding: '10px', backgroundColor: '#0f0f0f', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                    <label htmlFor="heatmap-score-type" style={{ marginRight: '10px', color: '#e0e0e0' }}>Heatmap Score: </label>
                    <select
                      id="heatmap-score-type"
                      value={heatmapScoreType}
                      onChange={(e) => setHeatmapScoreType(e.target.value)}
                      style={{ padding: '8px', backgroundColor: '#1a1a1a', color: '#e0e0e0', border: '1px solid #444', borderRadius: '4px' }}
                    >
                      <option value="total_score">Total Score</option>
                      <option value="train_score">Train Score</option>
                      <option value="all_reduce_score">AllReduce Score</option>
                    </select>
                  </div>
                  <h3 style={{ marginTop: '10px' }}></h3>
                  
                  {/* Conditional rendering for the heatmap table itself */}
                  {allValidatorUIDs.length > 0 ? (
                    <div className="miner-score-heatmap-container" style={{ overflowX: 'auto', marginBottom: '30px' }}>
                      <table className="scores-table heatmap-table">
                        <thead>
                          <tr>
                            <th style={{ minWidth: '100px' }}>Miner UID</th>
                            {allValidatorUIDs.map(valUid => <th key={`head-${valUid}`} style={{ minWidth: '80px', textAlign: 'center' }}>Val {valUid}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMiners.map(minerUid => {
                            const mData = minerData[minerUid];
                            // Loading and error states for this miner's row in the heatmap
                            if (loading.minerData[minerUid]) {
                              return (
                                <tr key={`heatmap-loading-${minerUid}`}><td>{minerUid}</td><td colSpan={allValidatorUIDs.length} style={{ textAlign: 'center' }}>Loading...</td></tr>
                              );
                            }
                            if (error.minerData[minerUid] || !mData) {
                              return (
                                <tr key={`heatmap-error-${minerUid}`}><td>{minerUid}</td><td colSpan={allValidatorUIDs.length} style={{ textAlign: 'center', color: '#ffcccc' }}>{error.minerData[minerUid] || "No data"}</td></tr>
                              );
                            }
                            return (
                              <tr key={`row-${minerUid}`}>
                                <td>{minerUid}</td>
                                {allValidatorUIDs.map(valUid => {
                                  const scoreData = mData?.scores?.[valUid];
                                  const scoreValue = scoreData ? scoreData[heatmapScoreType] : null;
                                  const displayValue = (scoreValue !== null && scoreValue !== undefined && !isNaN(scoreValue)) ? scoreValue.toFixed(4) : 'N/A';
                                  return (
                                    <td
                                    key={`cell-${minerUid}-${valUid}`}
                                      style={{
                                        backgroundColor: getScoreColor(scoreValue),
                                        textAlign: 'center',
                                        color: getTextColorForScore(scoreValue),
                                        fontWeight: 'normal',
                                        padding: '8px 5px',
                                        border: '1px solid #222'
                                      }}
                                      title={`Miner ${minerUid} - Val ${valUid}: ${displayValue}`}
                                      >
                                      {displayValue}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="heatmap-legend"></div>
                    </div>
                  ) : (
                    // This message shows if there are selected miners but no common validators found or no scores yet.
                    selectedMiners.length > 0 && <div className="no-data" style={{padding: '10px', textAlign: 'center'}}>No validator scores available to display in heatmap for the selected miners.</div>
                  )}
                </div>

                {/* Section 3.3: Combined Charts (Loss & Incentive) */}
                {/* Purpose: Visually compare time-series data for selected miners. */}
                {/* Status: This is correctly placed now, inside the selectedMiners.length > 0 block. */}
                <div className="charts data-section-container"> {/* Wrapper for both charts */}
                  
                  {/* --- TRAINING LOSS CHART CONTAINER --- */}
                  <div className="chart-container">
                    <h3>Loss</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="inner_step" 
                          type="number"       
                          domain={['dataMin', 'dataMax']}
                          allowDuplicatedCategory={false}
                        />
                        <YAxis 
                          type="number"       
                          domain={['dataMin', 'dataMax']}
                        />
                        <Tooltip content={<CustomChartTooltip labelFormatterName="minerExplorerLoss" />} /> {/* <--- USE CUSTOM TOOLTIP */}
                        <Legend />
                        {selectedMiners.map((uid, index) => {
                          const lossData = minerData[uid]?.training?.loss;
                          if (lossData && lossData.length > 0) {
                            const validLossData = lossData.filter(p => typeof p.inner_step === 'number');
                            if (validLossData.length === 0) return null;
                            const augmentedData = validLossData.map(p => ({ ...p, minerUidShort: `Miner ${uid}` }));
                            return ( <Line key={`loss-${uid}`} type="monotone" data={augmentedData} dataKey="value" name={`Miner ${uid} Loss`} stroke={MINER_COLORS[index % MINER_COLORS.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 5 }} connectNulls={true} /> );
                          }
                          return null;
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                    {/* Conditional "no data" message for LOSS chart */}
                    {selectedMiners.every(uid => loading.minerData[uid]) ? null : // Don't show "no data" if all are loading
                      (selectedMiners.length > 0 && selectedMiners.filter(uid => minerData[uid]?.training?.loss && minerData[uid]?.training?.loss.length > 0).length === 0) &&
                      <div className="no-data" style={{ fontSize: '0.9em', marginTop: '10px' }}>No training loss data available for the selected miners.</div>
                    }
                  </div> {/* --- END OF LOSS CHART CONTAINER --- */}

                  {/* --- INCENTIVE CHART CONTAINER --- */}
                  <div className="chart-container">
                    <h3>Incentive</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="time"
                          type="number" 
                          scale="time"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(unixTime) => {
                            if (typeof unixTime !== 'number') return '';
                            return new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          }}
                        />
                        <YAxis yAxisId="left" domain={['auto', 'auto']} tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(5) : value)} />
                        <Tooltip content={<CustomChartTooltip labelFormatterName="minerExplorerIncentive" />} /> {/* <--- USE CUSTOM TOOLTIP */}
                        <Legend />
                        {selectedMiners.map((uid, index) => {
                          const incentiveData = minerData[uid]?.incentive_timeseries;
                          if (incentiveData && incentiveData.length > 0) {
                            const validDataWithTimestamps = incentiveData
                              .map(p => {
                                if (!p.time || typeof p.time !== 'string') return null;
                                const dateObj = new Date(p.time);
                                if (dateObj.toString() === "Invalid Date") return null;
                                return { ...p, time: dateObj.getTime() };
                              })
                              .filter(p => p !== null);
                            if (validDataWithTimestamps.length === 0) return null;
                            const augmentedData = validDataWithTimestamps.map(p => ({ ...p, minerUidShort: `Miner ${uid}` }));
                            return ( <Line key={`incentive-${uid}`} type="monotone" data={augmentedData} dataKey="value" name={`Miner ${uid} Incentive`} yAxisId="left" stroke={MINER_COLORS[(index + Math.floor(MINER_COLORS.length / 2)) % MINER_COLORS.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 5 }} connectNulls={true} /> );
                          }
                          return null;
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                    {/* Conditional "no data" message for INCENTIVE chart */}
                    {selectedMiners.every(uid => loading.minerData[uid]) ? null : // Don't show "no data" if all are loading
                      (selectedMiners.length > 0 && selectedMiners.filter(uid => minerData[uid]?.incentive_timeseries && minerData[uid]?.incentive_timeseries.length > 0).length === 0) &&
                      <div className="no-data" style={{ fontSize: '0.9em', marginTop: '10px' }}>No incentive data available for the selected miners.</div>
                    }
                  </div> {/* --- END OF INCENTIVE CHART CONTAINER --- */}

                </div> {/* End of div.charts data-section-container */}

                {/* Section 3.4: Old Individual Miner Details Loop - CONFIRM IF TO REMOVE */}
                {/* Purpose: Previously showed stacked full details for each miner. */}
                {/* Status: Should be removed if the summary table and heatmap are sufficient replacements. */}
                {/* If you still want this, it's correctly placed within the selectedMiners.length > 0 block. */}
                {/*
                {selectedMiners.map((uid) => (
                  <div key={uid} className="miner-details-section" style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px'}}>
                    <h3>Details for Miner {uid}</h3>
                    {loading.minerData[uid] && ( /* ... * / )}
                    {error.minerData[uid] && ( /* ... * / )}
                    {!loading.minerData[uid] && !error.minerData[uid] && minerData[uid] && (
                      <div>
                        {/* Metagraph Metrics Grid & Validator Scores Table for this specific UID * /
                      </div>
                    )}
                    {!loading.minerData[uid] && !minerData[uid] && !error.minerData[uid] && ( /* ... * / )}
                  </div>
                ))}
                */}

              </> // End of Main Fragment for selected miners content
            )} {/* End of selectedMiners.length > 0 conditional block */}
          </div> // End of div.miner-explorer
        )}

        {activeTab === "allreduce" && (
           <div className="allreduce-operations">
            <h2>AllReduce Operations</h2>

            {loading.allreduce ? (
              <div className="loading">Loading AllReduce operations...</div>
            ) : error.allreduce ? (
              <div className="error-message">{error.allreduce}</div>
            ) : (
              <>
                <div className="operations-table-container">
                  <h3>Operations Log</h3>
                  {allReduceOperations.length > 0 ? (
                    <table className="operations-table main-operations-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30px' }}></th>
                          <th>Block Number</th>
                          <th>Epoch</th>
                          <th>Time</th>
                          <th>Reporting Validators</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allReduceOperations.map((op) => {
                          const currentOpKey = getOpKey(op);
                          const isExpanded = expandedOpKey === currentOpKey;
                          return (
                            <Fragment key={currentOpKey}>
                              <tr className={isExpanded ? 'expanded-row-header' : ''}>
                                <td>
                                  <button
                                    className="expand-button"
                                    onClick={() => setExpandedOpKey(isExpanded ? null : currentOpKey)}
                                    aria-expanded={isExpanded}
                                    aria-controls={`details-${currentOpKey}`}
                                  >
                                    {isExpanded ? '−' : '+'}
                                  </button>
                                </td>
                                <td>{op.operation_id || 'N/A'}</td>
                                <td>{op.epoch || 'N/A'}</td>
                                <td>{op.representative_time ? formatFullDate(op.representative_time) : 'N/A'}</td>
                                <td>{op.validator_reports?.length || 0}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="expanded-row-content">
                                  <td colSpan="5">
                                    <div id={`details-${currentOpKey}`} className="validator-details-container">
                                      <h4>Validator Reports for Operation {op.operation_id} (Epoch {op.epoch})</h4>
                                      {op.validator_reports && op.validator_reports.length > 0 ? (
                                        <table className="validator-details-table">
                                          <thead>
                                            <tr>
                                              <th>Validator UID</th>
                                              <th>Report Time</th>
                                              <th>Duration (s)</th>
                                              <th>Success Rate</th>
                                              <th>Bandwidth (MB/s)</th>
                                              <th>Miner Count</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {op.validator_reports.map(report => (
                                              <tr key={report.validator_uid}>
                                                <td>{report.validator_uid}</td>
                                                <td>{report.time ? formatFullDate(report.time) : 'N/A'}</td>
                                                <td>{report.metrics?.duration?.toFixed(2) ?? 'N/A'}</td>
                                                <td>
                                                  {report.metrics?.success_rate != null ? (
                                                    <span>{(report.metrics.success_rate * 100).toFixed(1)}%</span>
                                                  ) : 'N/A'}
                                                </td>
                                                <td>{report.metrics?.bandwidth?.toFixed(2) ?? 'N/A'}</td>
                                                <td>{report.metrics?.participating_miners ?? 'N/A'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      ) : (
                                         <div className="no-data">No detailed validator reports for this operation.</div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No AllReduce operations recorded</div>
                  )}
                </div>

                {allReduceOperations.length > 0 ? (
                  <div className="charts-section">
                    <div className="chart-container">
                      <h3>Average Success Rate</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={allReduceOperations
                            .map(op => {
                              let avgSuccessRate = null;
                              if (op.validator_reports && op.validator_reports.length > 0) {
                                const validRates = op.validator_reports.map(r => r.metrics?.success_rate).filter(r => r != null);
                                if (validRates.length > 0) {
                                    avgSuccessRate = validRates.reduce((sum, r) => sum + r, 0) / validRates.length;
                                }
                              }
                              return {
                                time: op.representative_time || new Date().toISOString(),
                                value: avgSuccessRate
                              };
                            })
                            .filter(item => item.value != null)
                            .slice().reverse()}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()} />
                          <YAxis domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                          <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Avg Success Rate']} />
                          <Legend />
                          <Line type="monotone" dataKey="value" stroke="#00bcd4" name="Avg Success Rate" strokeWidth={2} dot={false} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="chart-container">
                      <h3>Average AllReduce Duration</h3>
                       <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={allReduceOperations
                            .map(op => {
                              let avgDuration = null;
                              if (op.validator_reports && op.validator_reports.length > 0) {
                                const validDurations = op.validator_reports.map(r => r.metrics?.duration).filter(d => d != null);
                                if (validDurations.length > 0) {
                                    avgDuration = validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length;
                                }
                              }
                              return {
                                time: op.representative_time || new Date().toISOString(),
                                value: avgDuration
                              };
                            })
                            .filter(item => item.value != null)
                            .slice().reverse()}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()} />
                          <YAxis />
                          <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} formatter={(value) => [value.toFixed(2), 'Avg Seconds']} />
                          <Legend />
                          <Line type="monotone" dataKey="value" stroke="#ff5722" name="Avg Duration" strokeWidth={2} dot={false} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="auto-refresh">
        <button 
          className="refresh-button"
          onClick={() => {
            if (activeTab === "global") {
                fetchGlobalMetrics();
                fetchMinerLocations();
            } else if (activeTab === "miners") {
                fetchMiners();
                selectedMiners.forEach(uid => fetchMinerData(uid)); // Re-fetch data for all selected miners
            } else if (activeTab === "allreduce") {
                fetchAllReduceOperations();
            }
          }}
        >
          Refresh Data
        </button>
        <span className="last-updated">
          Last updated: {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}