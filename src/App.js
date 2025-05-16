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


const MINER_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F",
  "#FFBB28", "#FF8042", "#0088FE", "#A3A1FB", "#D4A1FB",
  "#4CAF50", "#F44336", "#E91E63", "#9C27B0", "#3F51B5",
  "#2196F3", "#00BCD4", "#009688", "#CDDC39", "#FFEB3B",
];


export default function App() {
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

  const fetchGlobalMetrics = useCallback(async () => {
    setLoading(prev => ({ ...prev, global: true }));
    setError(prev => ({ ...prev, global: null }));
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/global`);
      // ---- START DEBUG LOGS ----
      console.log("API Response for /metrics/global:", response.data);
      console.log("Raw all_miner_losses from API:", response.data.all_miner_losses);
      console.log("Raw all_miner_perplexities from API:", response.data.all_miner_perplexities);
      // ---- END DEBUG LOGS ----

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
      setMiners(Array.isArray(response.data) ? response.data.map(uid => ({
        value: uid.toString(),
        label: `Miner ${uid}`
      })) : []);
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


  useEffect(() => {
    if (activeTab === "global") {
      fetchGlobalMetrics();
      fetchMinerLocations();
    }
  }, [activeTab, fetchGlobalMetrics, fetchMinerLocations]);

  useEffect(() => {
    if (activeTab === "miners" && selectedMiners.length > 0) {
      selectedMiners.forEach(uid => {
        // Fetch only if not already loading and (data doesn't exist or an error occurred previously)
        if (!loading.minerData[uid] && (!minerData[uid] || error.minerData[uid])) {
          fetchMinerData(uid);
        }
      });
      // Cleanup: Remove data for miners no longer selected
      const currentSelectedUIDs = new Set(selectedMiners);
      setMinerData(prevMinerData => {
          const nextMinerData = { ...prevMinerData };
          Object.keys(nextMinerData).forEach(uid => {
              if (!currentSelectedUIDs.has(uid)) {
                  delete nextMinerData[uid];
              }
          });
          return nextMinerData;
      });

    } else if (activeTab === "miners" && selectedMiners.length === 0) {
      setMinerData({}); // Clear all miner data if no miners are selected
    }
  }, [activeTab, selectedMiners, fetchMinerData, loading.minerData, error.minerData, minerData]); // Added minerData to deps for cleanup logic

  useEffect(() => {
    if (activeTab === "allreduce") {
      fetchAllReduceOperations();
    }
  }, [activeTab, fetchAllReduceOperations]);

  useEffect(() => {
    if (selectedMiner && activeTab === "miners") {
      fetchMinerData(selectedMiner);
    }
  }, [selectedMiner, activeTab, fetchMinerData]);

  const handleMinerSelectChange = (event) => {
    const { options } = event.target;
    const values = [];
    for (let i = 0, l = options.length; i < l; i += 1) {
      if (options[i].selected) {
        values.push(options[i].value);
      }
    }
    setSelectedMiners(values);
  };

  const latestTotalBandwidth = globalData?.global_total_bandwidth_series && globalData.global_total_bandwidth_series.length > 0
    ? globalData.global_total_bandwidth_series[globalData.global_total_bandwidth_series.length - 1]?.value?.toFixed(2)
    : "0";

  const latestAvgTrainingRate = globalData?.global_average_training_rate_series && globalData.global_average_training_rate_series.length > 0
    ? globalData.global_average_training_rate_series[globalData.global_average_training_rate_series.length - 1]?.value?.toFixed(0)
    : "0";
  
  const activeMinersCurrentCount = globalData?.active_miners_current || "0";
    
  // This is now the "Outer Step"
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
                  <div className="loading" style={{ textAlign: 'center', padding: '20px' }}>Loading map data...</div>
                ) : error.locations ? (
                  <div className="error-message" style={{ textAlign: 'center', padding: '20px' }}>{error.locations}</div>
                ) : minerLocations.length > 0 ? (
                  <GlobalNetworkMap locations={minerLocations} mapHeight="350px" />
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
            {/* ---- START DEBUG LOGS ---- */}
            {console.log("globalData.all_miner_losses in render:", globalData.all_miner_losses)}
            {console.log("globalData.all_miner_perplexities in render:", globalData.all_miner_perplexities)}
            {/* ---- END DEBUG LOGS ---- */}
            {loading.global ? (
              <div className="loading" style={{ marginTop: '20px'}}>Loading global metrics...</div>
            ) : error.global ? (
              <div className="error-message" style={{ marginTop: '20px'}}>{error.global}</div>
            ) : (
              <div className="charts-row">
                <div className="chart-container half-width">
                  {/* Removed Outer Step from title */}
                  <h3>Miner Loss (vs Inner Step)</h3>
                  {globalData?.all_miner_losses && Object.keys(globalData.all_miner_losses).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 5 }}> {/* Adjusted right margin for YAxis labels */}
                        <CartesianGrid strokeDasharray="3 3" />
                        {/* X-axis is now inner_step */}
                        <XAxis
                          dataKey="inner_step"
                          type="number" // Important for numeric data
                          domain={['dataMin', 'dataMax']} // Auto domain
                          allowDuplicatedCategory={false} // Not needed for type="number"
                          // tickFormatter={(tick) => tick.toLocaleString()} // Simple number format
                        />
                        <YAxis domain={['auto', 'auto']} /> {/* Let Y-axis auto-scale */}
                        <Tooltip
                          labelFormatter={stepTooltipLabelFormatter} // Use custom formatter
                          formatter={(value) => value.toFixed(4)} // Format loss value
                        />
                        <Legend />
                        {Object.entries(globalData.all_miner_losses).map(([minerUid, lossData], index) => (
                          lossData && lossData.length > 0 && (
                            <Line
                              key={`loss-${minerUid}`}
                              type="monotone"
                              data={lossData} // Each miner gets their own data array
                              dataKey="value" // Y-axis value
                              name={`Miner ${minerUid} Loss`}
                              stroke={MINER_COLORS[index % MINER_COLORS.length]}
                              strokeWidth={1.5}
                              dot={false}
                              activeDot={{ r: 5 }}
                              isAnimationActive={false} // Optional: disable animation for performance
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
                  <h3>Miner Perplexity (vs Inner Step)</h3>
                  {globalData?.all_miner_perplexities && Object.keys(globalData.all_miner_perplexities).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="inner_step"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          // tickFormatter={(tick) => tick.toLocaleString()}
                        />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip
                          labelFormatter={stepTooltipLabelFormatter}
                          formatter={(value) => value.toFixed(2)} // Format perplexity
                        />
                        <Legend />
                        {Object.entries(globalData.all_miner_perplexities).map(([minerUid, perplexityData], index) => (
                          perplexityData && perplexityData.length > 0 && (
                            <Line
                              key={`perplexity-${minerUid}`}
                              type="monotone"
                              data={perplexityData}
                              dataKey="value"
                              name={`Miner ${minerUid} Perplexity`}
                              stroke={MINER_COLORS[index % MINER_COLORS.length]}
                              strokeWidth={1.5}
                              dot={false}
                              activeDot={{ r: 5 }}
                              isAnimationActive={false}
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

        {/* ... (Miner Explorer and AllReduce Operations tabs remain the same) ... */}
        {activeTab === "miners" && (
          <div className="miner-explorer">
            <h2>Miner Explorer</h2>
            
            {loading.miners ? (
              <div className="loading">Loading miners list...</div>
            ) : error.miners ? (
              <div className="error-message">{error.miners}</div>
            ) : miners.length > 0 ? (
              <div className="miner-select">
                <label className="select-label" htmlFor="miner-select">
                  Select Miner UIDs to Compare (Ctrl/Cmd + Click for multiple)
                </label>
                {/* Simple HTML multi-select. Consider react-select for better UX. */}
                <select
                  id="miner-select"
                  className="miner-select-dropdown"
                  multiple={true} // Enable multi-select
                  value={selectedMiners} // selectedMiners is an array of strings
                  onChange={handleMinerSelectChange}
                  size={Math.min(miners.length, 10)} // Show some options
                  style={{ minHeight: '100px', overflowY: 'auto' }}
                >
                  {/* <option value="" disabled>Choose miners to compare</option> remove this for multi-select or handle it */}
                  {miners.map(miner => (
                    <option key={miner.value} value={miner.value}>{miner.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="no-data">No miners available</div>
            )}
            
            {selectedMiners.length === 0 && !loading.miners && miners.length > 0 && (
              <div className="no-miner-selected">
                <p>Select one or more miners to view detailed metrics.</p>
              </div>
            )}

            {selectedMiners.length > 0 && (
              <>
                {/* Combined Charts Section */}
                <div className="charts">
                  <div className="chart-container">
                    <h3>Training Loss Comparison</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        {/* Assuming X-axis is time or step. Adjust if needed. */}
                        <XAxis 
                          dataKey="time" // Or "inner_step" if consistent across selected miners' loss data
                          tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()} 
                          allowDuplicatedCategory={false} // If using time for X-axis
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                          formatter={(value, name, props) => [value.toFixed(4), `Loss (${props.payload.minerUidShort || name})`]}
                        />
                        <Legend />
                        {selectedMiners.map((uid, index) => {
                          const data = minerData[uid]?.training?.loss;
                          if (data && data.length > 0) {
                            // Add minerUidShort to each data point for richer tooltips
                            const augmentedData = data.map(p => ({...p, minerUidShort: `Miner ${uid}`}));
                            return (
                              <Line 
                                key={`loss-${uid}`}
                                type="monotone" 
                                data={augmentedData}
                                dataKey="value" 
                                name={`Miner ${uid} Loss`}
                                stroke={MINER_COLORS[index % MINER_COLORS.length]}
                                strokeWidth={2}
                                activeDot={{ r: 6 }}
                                dot={false}
                              />
                            );
                          }
                          return null;
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                    {/* Check if any selected miner has no loss data */}
                    {selectedMiners.some(uid => !minerData[uid]?.training?.loss || minerData[uid]?.training?.loss.length === 0) &&
                     selectedMiners.filter(uid => minerData[uid]?.training?.loss && minerData[uid]?.training?.loss.length > 0).length < selectedMiners.length &&
                     !selectedMiners.every(uid => loading.minerData[uid]) && // Only show if not all are loading
                     <div className="no-data" style={{fontSize: '0.9em', marginTop: '10px'}}>Some selected miners may not have loss data.</div>
                    }
                  </div>
                  
                  <div className="chart-container">
                    <h3>Incentive Over Time Comparison</h3>
                    <ResponsiveContainer width="100%" height={300}>
                       <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="time"
                          tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()} 
                          allowDuplicatedCategory={false}
                        />
                        <YAxis domain={['auto', 'auto']} tickFormatter={(value) => value.toFixed(4)}/>
                        <Tooltip
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                          formatter={(value, name, props) => [value.toFixed(5), `Incentive (${props.payload.minerUidShort || name})`]}
                        />
                        <Legend />
                        {selectedMiners.map((uid, index) => {
                          const data = minerData[uid]?.incentive_timeseries;
                          if (data && data.length > 0) {
                            const augmentedData = data.map(p => ({...p, minerUidShort: `Miner ${uid}`}));
                            return (
                              <Line
                                key={`incentive-${uid}`}
                                type="monotone"
                                data={augmentedData}
                                dataKey="value" 
                                name={`Miner ${uid} Incentive`}
                                stroke={MINER_COLORS[(index + 5) % MINER_COLORS.length]} // Offset color
                                strokeWidth={2}
                                activeDot={{ r: 6 }}
                                dot={false}
                              />
                            );
                          }
                          return null;
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                     {selectedMiners.some(uid => !minerData[uid]?.incentive_timeseries || minerData[uid]?.incentive_timeseries.length === 0) &&
                     selectedMiners.filter(uid => minerData[uid]?.incentive_timeseries && minerData[uid]?.incentive_timeseries.length > 0).length < selectedMiners.length &&
                     !selectedMiners.every(uid => loading.minerData[uid]) &&
                     <div className="no-data" style={{fontSize: '0.9em', marginTop: '10px'}}>Some selected miners may not have incentive data.</div>
                    }
                  </div>
                </div>

                {/* Individual Miner Details Section */}
                {selectedMiners.map((uid) => (
                  <div key={uid} className="miner-details-section" style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px'}}>
                    <h3>Details for Miner {uid}</h3>
                    {loading.minerData[uid] && (
                      <div className="loading">Loading data for Miner {uid}...</div>
                    )}
                    {error.minerData[uid] && (
                      <div className="error-message">{error.minerData[uid]}</div>
                    )}
                    {!loading.minerData[uid] && !error.minerData[uid] && minerData[uid] && (
                      <div>
                        <div className="miner-metrics">
                          <h4>Metagraph Metrics (UID: {uid})</h4>
                          <div className="metrics-grid">
                            <div className="metric-item">
                              <h5>Stake</h5>
                              <p>{minerData[uid]?.metagraph?.stake?.toFixed(2) || 0} TAO</p>
                            </div>
                            <div className="metric-item">
                              <h5>Trust</h5>
                              <p>{minerData[uid]?.metagraph?.trust?.toFixed(4) || 0}</p>
                            </div>
                            <div className="metric-item">
                              <h5>Consensus</h5>
                              <p>{minerData[uid]?.metagraph?.consensus?.toFixed(4) || 0}</p>
                            </div>
                            <div className="metric-item">
                              <h5>Incentive</h5>
                              <p>{minerData[uid]?.metagraph?.incentive?.toFixed(4) || 0}</p>
                            </div>
                            <div className="metric-item">
                              <h5>Emissions</h5>
                              <p>{minerData[uid]?.metagraph?.emissions?.toFixed(4) || 0} τ/day</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="validator-scores">
                          <h4>Validator Scores (UID: {uid})</h4>
                          {minerData[uid]?.scores && Object.keys(minerData[uid].scores).length > 0 ? (
                            <table className="scores-table">
                              <thead>
                                <tr>
                                  <th>Validator</th>
                                  <th>Training Score</th>
                                  <th>AllReduce Score</th>
                                  <th>Total Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(minerData[uid].scores).map(([validator, scores]) => (
                                  <tr key={`${uid}-${validator}`}>
                                    <td>Validator {validator}</td>
                                    <td>{(scores?.train_score || 0).toFixed(4)}</td>
                                    <td>{(scores?.all_reduce_score || 0).toFixed(4)}</td>
                                    <td>{(scores?.total_score || 0).toFixed(4)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="no-data">No validator scores available for this miner</div>
                          )}
                        </div>
                      </div>
                    )}
                    {!loading.minerData[uid] && !minerData[uid] && !error.minerData[uid] && (
                      <div className="no-data">No data available for Miner {uid} yet.</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
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
                  <h3>Recent Operations Log</h3>
                  {allReduceOperations.length > 0 ? (
                    <table className="operations-table main-operations-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30px' }}></th>
                          <th>Operation ID</th>
                          <th>Epoch</th>
                          <th>Time (Earliest Report)</th>
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
                  <div className="charts">
                    <div className="chart-container">
                      <h3>Avg Success Rate Trend</h3>
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
                      <h3>Avg AllReduce Duration</h3>
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