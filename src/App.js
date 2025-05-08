// src/App.js
import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import "./styles.css";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_FASTAPI_URL || "http://localhost:8000"; // Ensure your .env uses REACT_APP_ prefix or Vite's VITE_ prefix

// Format time helper
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return date.toLocaleTimeString();
};

const formatFullDate = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return date.toLocaleString();
};

// Define some colors for miner lines, or generate them dynamically
const MINER_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F",
  "#FFBB28", "#FF8042", "#0088FE", "#A3A1FB", "#D4A1FB",
  "#4CAF50", "#F44336", "#E91E63", "#9C27B0", "#3F51B5",
  "#2196F3", "#00BCD4", "#009688", "#CDDC39", "#FFEB3B",
];


export default function App() {
  const [activeTab, setActiveTab] = useState("global");
  const [selectedMiner, setSelectedMiner] = useState(null);
  const [loading, setLoading] = useState({
    global: false,
    miners: false,
    minerData: false,
    allreduce: false
  });
  const [error, setError] = useState({
    global: null,
    miners: null,
    minerData: null,
    allreduce: null
  });

  // Updated globalData state structure
  const [globalData, setGlobalData] = useState({
    all_miner_losses: {},
    all_miner_perplexities: {},
    // global_average_loss_series: [], // We can derive average for display if needed, or plot all
    // global_average_perplexity_series: [], // Same as above
    global_max_epoch_series: [],
    global_average_training_rate_series: [],
    global_total_bandwidth_series: [],
    active_miners_count_series: [],
    active_miners_current: 0,
  });

  const [miners, setMiners] = useState([]);
  const [minerData, setMinerData] = useState(null); // Stays the same for individual miner
  const [allReduceOperations, setAllReduceOperations] = useState([]); // Stays the same

  const fetchGlobalMetrics = useCallback(async () => {
    setLoading(prev => ({ ...prev, global: true }));
    setError(prev => ({ ...prev, global: null }));
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/global`);
      setGlobalData({
        all_miner_losses: response.data.all_miner_losses || {},
        all_miner_perplexities: response.data.all_miner_perplexities || {},
        // Assuming backend now provides these specific keys based on our last discussion
        global_max_epoch_series: response.data.global_max_epoch_series || [],
        global_average_training_rate_series: response.data.global_average_training_rate_series || [],
        global_total_bandwidth_series: response.data.global_total_bandwidth_series || [],
        active_miners_count_series: response.data.active_miners_count_series || [],
        active_miners_current: response.data.active_miners_current || 0,
      });
    } catch (err) {
      console.error("Error fetching global metrics:", err);
      setError(prev => ({ ...prev, global: "No data currently available. Please try again later." }));
      setGlobalData({ // Reset to initial structure on error
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

  // fetchMiners, fetchMinerData, fetchAllReduceOperations remain the same
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
    if (!uid) { // Prevent fetching if uid is null or empty
        setMinerData(null);
        return;
    }
    setLoading(prev => ({ ...prev, minerData: true }));
    setError(prev => ({ ...prev, minerData: null }));

    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/miner/${uid}`);
      setMinerData(response.data);
    } catch (err) {
      console.error(`Error fetching data for miner ${uid}:`, err);
      setError(prev => ({ ...prev, minerData: "No data currently available for this miner. Please try again later." }));
      setMinerData(null);
    } finally {
      setLoading(prev => ({ ...prev, minerData: false }));
    }
  }, []);

  const fetchAllReduceOperations = useCallback(async () => {
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


  useEffect(() => {
    if (activeTab === "global") {
      fetchGlobalMetrics();
    }
  }, [activeTab, fetchGlobalMetrics]);

  useEffect(() => {
    if (activeTab === "miners") {
      fetchMiners();
      // If a miner was previously selected, re-fetch their data when switching to this tab
      // or clear it if you prefer the user to re-select.
      if (selectedMiner) {
        fetchMinerData(selectedMiner);
      } else {
        setMinerData(null); // Clear previous miner data if no miner is selected
      }
    }
  }, [activeTab, fetchMiners, selectedMiner, fetchMinerData]); // Added selectedMiner & fetchMinerData

  useEffect(() => {
    if (activeTab === "allreduce") {
      fetchAllReduceOperations();
    }
  }, [activeTab, fetchAllReduceOperations]);

  // This useEffect specifically handles fetching data when selectedMiner changes.
  // It's separate from the tab switching logic.
  useEffect(() => {
    if (selectedMiner && activeTab === "miners") { // Only fetch if on miners tab and a miner is selected
      fetchMinerData(selectedMiner);
    }
  }, [selectedMiner, activeTab, fetchMinerData]); // Ensure activeTab is a dependency

  const handleMinerSelect = (uid) => {
    setSelectedMiner(uid); // This will trigger the useEffect above if activeTab is "miners"
  };


  // Calculate key metrics for display - these now use the new globalData structure
  // For average bandwidth and training rate, we'll display the latest value from the series
  const latestTotalBandwidth = globalData?.global_total_bandwidth_series && globalData.global_total_bandwidth_series.length > 0
    ? globalData.global_total_bandwidth_series[globalData.global_total_bandwidth_series.length - 1]?.value?.toFixed(2)
    : "0";

  const latestAvgTrainingRate = globalData?.global_average_training_rate_series && globalData.global_average_training_rate_series.length > 0
    ? globalData.global_average_training_rate_series[globalData.global_average_training_rate_series.length - 1]?.value?.toFixed(0)
    : "0";
  
  const activeMinersCurrentCount = globalData?.active_miners_current || "0";
    
  const currentMaxEpoch = globalData?.global_max_epoch_series && globalData.global_max_epoch_series.length > 0
    ? globalData.global_max_epoch_series[globalData.global_max_epoch_series.length - 1]?.value
    : "0";


  return (
    <div className="App">
      <div className="header">
        <h1>Distributed Training</h1>
        <p>Communally Training LLMs</p>
        <div className="tabs">
          {/* ... tab buttons ... */}
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
            <h2>Global Training Overview</h2> {/* Updated Title */}
            
            {loading.global ? (
              <div className="loading">Loading global metrics...</div>
            ) : error.global ? (
              <div className="error-message">{error.global}</div>
            ) : (
              <>
                <div className="charts">
                  {/* All Miner Losses Chart */}
                  <div className="chart-container full-width">
                    <h3>All Miner Losses <span className="epoch-indicator">Max Epoch {currentMaxEpoch}</span></h3>
                    {globalData?.all_miner_losses && Object.keys(globalData.all_miner_losses).length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" type="category" allowDuplicatedCategory={false} tickFormatter={formatTime} />
                          <YAxis />
                          <Tooltip labelFormatter={formatFullDate} />
                          <Legend />
                          {Object.entries(globalData.all_miner_losses).map(([minerUid, lossData], index) => (
                            lossData && lossData.length > 0 && (
                              <Line
                                key={`loss-${minerUid}`}
                                type="monotone"
                                data={lossData}
                                dataKey="value"
                                name={`Miner ${minerUid} Loss`}
                                stroke={MINER_COLORS[index % MINER_COLORS.length]}
                                strokeWidth={1.5}
                                dot={false}
                                activeDot={{ r: 5 }}
                              />
                            )
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="no-data">No miner loss data available</div>
                    )}
                  </div>

                  {/* All Miner Perplexities Chart */}
                  <div className="chart-container full-width">
                    <h3>All Miner Perplexities <span className="epoch-indicator">Max Epoch {currentMaxEpoch}</span></h3>
                    {globalData?.all_miner_perplexities && Object.keys(globalData.all_miner_perplexities).length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" type="category" allowDuplicatedCategory={false} tickFormatter={formatTime} />
                          <YAxis />
                          <Tooltip labelFormatter={formatFullDate}/>
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
                              />
                            )
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="no-data">No miner perplexity data available</div>
                    )}
                  </div>
                </div>

                {/* Updated Stats Overview Cards */}
                <div className="stats-overview">
                  <div className="stat-overview-card">
                    <div className="stat-icon bandwidth-icon">📶</div>
                    <div className="stat-content">
                      <h3>Global Bandwidth (Total)</h3> {/* Clarified title */}
                      <p className="stat-value">
                        {latestTotalBandwidth !== "0" ? `${latestTotalBandwidth} MB/s` : "No data"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="stat-overview-card">
                    <div className="stat-icon tokens-icon">🚀</div>
                    <div className="stat-content">
                      <h3>Global Training Rate (Avg)</h3> {/* Clarified title */}
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
                </div>

                {/* Removed the smaller "stats" div as requested */}
                {/* 
                <div className="stats">
                  // ... old stat cards for Current Epoch, Current Loss, Perplexity ...
                </div>
                */}
              </>
            )}
          </div>
        )}

        {activeTab === "miners" && (
          <div className="miner-explorer">
            {/* ... Miner Explorer JSX (remains largely the same as your provided code) ... */}
            {/* Make sure the "Incentive Over Time" chart uses minerData.incentive_timeseries */}
            <h2>Miner Explorer</h2>
            
            {loading.miners ? (
              <div className="loading">Loading miners list...</div>
            ) : error.miners ? (
              <div className="error-message">{error.miners}</div>
            ) : miners.length > 0 ? (
              <div className="miner-select">
                <label className="select-label" htmlFor="miner-select">
                  Select Miner UID
                </label>
                <select
                  id="miner-select"
                  className="miner-select-dropdown"
                  value={selectedMiner || ''}
                  onChange={(e) => handleMinerSelect(e.target.value)}
                >
                  <option value="">Choose a miner</option>
                  {miners.map(miner => (
                    <option key={miner.value} value={miner.value}>{miner.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="no-data">No miners available</div>
            )}
            
            {loading.minerData && selectedMiner && ( // Only show loading if a miner is selected and loading
              <div className="loading">Loading data for Miner {selectedMiner}...</div>
            )}
            
            {error.minerData && selectedMiner &&( // Only show error if a miner is selected and error occurred
              <div className="error-message">{error.minerData}</div>
            )}
            
            {!loading.minerData && !error.minerData && minerData && selectedMiner && (
              <div>
                <div className="miner-metrics">
                  <h3>Miner Metrics (UID: {selectedMiner})</h3>
                  <div className="metrics-grid">
                    <div className="metric-item">
                      <h4>Stake</h4>
                      <p>{minerData?.metagraph?.stake?.toFixed(2) || 0} TAO</p>
                    </div>
                    <div className="metric-item">
                      <h4>Trust</h4>
                      <p>{minerData?.metagraph?.trust?.toFixed(4) || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Consensus</h4>
                      <p>{minerData?.metagraph?.consensus?.toFixed(4) || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Incentive</h4>
                      <p>{minerData?.metagraph?.incentive?.toFixed(4) || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Emissions</h4>
                      <p>{minerData?.metagraph?.emissions?.toFixed(4) || 0} τ/day</p>
                    </div>
                  </div>
                </div>
                
                <div className="charts">
                  <div className="chart-container">
                    <h3>Training Loss</h3>
                    {minerData?.training?.loss && minerData.training.loss.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={minerData.training.loss}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={formatTime} />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(label) => new Date(label).toLocaleString()}
                            formatter={(value) => [value.toFixed(4), 'Loss']} 
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#8884d8" 
                            name="Loss"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="no-data">No loss data available for this miner</div>
                    )}
                  </div>
                  
                  <div className="chart-container">
                    <h3>Incentive Over Time</h3>
                    {minerData?.incentive_timeseries && minerData.incentive_timeseries.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={minerData.incentive_timeseries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={formatTime} />
                          <YAxis  domain={['auto', 'auto']} tickFormatter={(value) => value.toFixed(4)}/> {/* Adjust domain/formatter if needed */}
                          <Tooltip
                            labelFormatter={(label) => new Date(label).toLocaleString()}
                            formatter={(value) => [value.toFixed(5), 'Incentive']}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="value" 
                            stroke="#387908"
                            name="Incentive"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="no-data">No incentive time-series data available for this miner</div>
                    )}
                  </div>
                </div>
                
                <div className="validator-scores">
                  <h3>Validator Scores</h3>
                  {minerData?.scores && Object.keys(minerData.scores).length > 0 ? (
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
                        {Object.entries(minerData.scores).map(([validator, scores]) => (
                          <tr key={validator}>
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
            
            {!loading.minerData && !selectedMiner && miners.length > 0 && (
              <div className="no-miner-selected">
                <p>Select a miner to view detailed metrics</p>
              </div>
            )}
             {!loading.minerData && selectedMiner && !minerData && !error.minerData && (
              <div className="no-data">No data available for Miner {selectedMiner} yet.</div>
            )}

          </div>
        )}

        {activeTab === "allreduce" && (
          // ... AllReduce Operations JSX (remains the same as your provided code) ...
          <div className="allreduce-operations">
            <h2>AllReduce Operations</h2>
            
            {loading.allreduce ? (
              <div className="loading">Loading AllReduce operations...</div>
            ) : error.allreduce ? (
              <div className="error-message">{error.allreduce}</div>
            ) : (
              <>
                <div className="operations-table-container">
                  <h3>Recent Operations</h3>
                  {allReduceOperations.length > 0 ? (
                    <table className="operations-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Epoch</th>
                          <th>Duration (s)</th>
                          <th>Miners</th>
                          <th>Success Rate</th>
                          <th>Bandwidth (MB/s)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allReduceOperations.map((op) => (
                          <tr key={op?.operation_id || Math.random()}>
                            <td>{op?.time ? new Date(op.time).toLocaleString() : 'N/A'}</td>
                            <td>{op?.epoch || 'N/A'}</td>
                            <td>{op?.metrics?.duration?.toFixed(2) || 'N/A'}</td>
                            <td>{op?.metrics?.participating_miners || 'N/A'}</td>
                            <td>
                              {op?.metrics?.success_rate != null ? (
                                <div className="success-rate">
                                  <div className="progress-bar">
                                    <div 
                                      className={`progress-fill ${
                                        op.metrics.success_rate >= 0.9 ? 'high' : 
                                        op.metrics.success_rate >= 0.7 ? 'medium' : 'low'
                                      }`} 
                                      style={{ width: `${op.metrics.success_rate * 100}%` }}
                                    ></div>
                                  </div>
                                  <span>{(op.metrics.success_rate * 100).toFixed(1)}%</span>
                                </div>
                              ) : 'N/A'}
                            </td>
                            <td>{op?.metrics?.bandwidth?.toFixed(2) || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No AllReduce operations recorded</div>
                  )}
                </div>
                
                {allReduceOperations.length > 0 ? (
                  <div className="charts">
                    <div className="chart-container">
                      <h3>Success Rate Trend</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart 
                          data={allReduceOperations.slice().reverse().map(op => ({
                            time: op?.time || new Date().toISOString(),
                            value: op?.metrics?.success_rate || 0
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={formatTime}
                          />
                          <YAxis 
                            domain={[0, 1]}
                            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                          />
                          <Tooltip 
                            labelFormatter={formatFullDate}
                            formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Success Rate']} 
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#00bcd4" 
                            name="Success Rate"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="chart-container">
                      <h3>AllReduce Duration</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart 
                          data={allReduceOperations.slice().reverse().map(op => ({
                            time: op?.time || new Date().toISOString(),
                            value: op?.metrics?.duration || 0
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={formatTime}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={formatFullDate}
                            formatter={(value) => [value.toFixed(2), 'Seconds']} 
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#ff5722" 
                            name="Duration"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
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
            } else if (activeTab === "miners") {
                fetchMiners(); // Refresh list of miners
                if (selectedMiner) { // If a miner is selected, refresh their data too
                    fetchMinerData(selectedMiner);
                }
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
