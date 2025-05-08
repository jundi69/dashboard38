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

const API_BASE_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// Format time helper
const formatTime = (timeStr) => {
  const date = new Date(timeStr);
  return date.toLocaleTimeString();
};

const formatFullDate = (timeStr) => {
  const date = new Date(timeStr);
  return date.toLocaleString();
};

// Calculate averages - safely handle empty or undefined data
const getAverage = (data) => {
  if (!data || data.length === 0) return 0;
  return data.reduce((acc, item) => acc + item.value, 0) / data.length;
};

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

  // Data state - initialize with empty arrays for all properties
  const [globalData, setGlobalData] = useState({
    epochs: [],
    loss: [],
    perplexity: [],
    training_rate: [],
    bandwidth: [],
    active_miners: []
  });
  const [miners, setMiners] = useState([]);
  const [minerData, setMinerData] = useState(null);
  const [allReduceOperations, setAllReduceOperations] = useState([]);

  // Fetch functions with proper state updates
  const fetchGlobalMetrics = useCallback(async () => {
    setLoading(prev => ({ ...prev, global: true }));
    setError(prev => ({ ...prev, global: null }));

    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/global`);
      // Ensure all expected properties exist
      setGlobalData({
        epochs: response.data.epochs || [],
        loss: response.data.loss || [],
        perplexity: response.data.perplexity || [],
        training_rate: response.data.training_rate || [],
        bandwidth: response.data.bandwidth || [],
        active_miners: response.data.active_miners || []
      });
    } catch (err) {
      console.error("Error fetching global metrics:", err);
      setError(prev => ({ ...prev, global: "No data currently available. Please try again later." }));
      // Clear any existing data
      setGlobalData({
        epochs: [],
        loss: [],
        perplexity: [],
        training_rate: [],
        bandwidth: [],
        active_miners: []
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
      // Clear miners list
      setMiners([]);
    } finally {
      setLoading(prev => ({ ...prev, miners: false }));
    }
  }, []);

  const fetchMinerData = useCallback(async (uid) => {
    setLoading(prev => ({ ...prev, minerData: true }));
    setError(prev => ({ ...prev, minerData: null }));

    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/miner/${uid}`);
      setMinerData(response.data);
    } catch (err) {
      console.error(`Error fetching data for miner ${uid}:`, err);
      setError(prev => ({ ...prev, minerData: "No data currently available. Please try again later." }));
      // Clear miner data
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
      // Clear operations
      setAllReduceOperations([]);
    } finally {
      setLoading(prev => ({ ...prev, allreduce: false }));
    }
  }, []);

  // Effects - these come after the fetch functions to avoid the use-before-define error
  useEffect(() => {
    if (activeTab === "global") {
      fetchGlobalMetrics();
    }
  }, [activeTab, fetchGlobalMetrics]);

  useEffect(() => {
    if (activeTab === "miners") {
      fetchMiners();
    }
  }, [activeTab, fetchMiners]);

  useEffect(() => {
    if (activeTab === "allreduce") {
      fetchAllReduceOperations();
    }
  }, [activeTab, fetchAllReduceOperations]);

  useEffect(() => {
    if (selectedMiner) {
      fetchMinerData(selectedMiner);
    }
  }, [selectedMiner, fetchMinerData]);

  const handleMinerSelect = (uid) => {
    setSelectedMiner(uid);
  };

  // Calculate key metrics - handle safely with optional chaining and fallbacks
  const avgBandwidth = getAverage(globalData?.bandwidth || []).toFixed(2);
  const avgTrainingRate = getAverage(globalData?.training_rate || []).toFixed(0);
  
  // Safe access to active_miners with checks
  const activeMinersCount = globalData?.active_miners && globalData.active_miners.length > 0 
    ? globalData.active_miners[globalData.active_miners.length - 1]?.value?.toFixed(0) || "0"
    : "0";
    
  // Safe access to epochs
  const currentEpoch = globalData?.epochs && globalData.epochs.length > 0 
    ? Math.max(...globalData.epochs.map(d => d?.value || 0))
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
            <h2>Global Model Performance</h2>
            
            {loading.global ? (
              <div className="loading">Loading global metrics...</div>
            ) : error.global ? (
              <div className="error-message">{error.global}</div>
            ) : (
              <>
                <div className="charts">
                  <div className="chart-container full-width">
                    <h3>Loss Over Time <span className="epoch-indicator">Epoch {currentEpoch}</span></h3>
                    {globalData?.loss && globalData.loss.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={globalData.loss}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={formatTime} />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(label) =>
                              new Date(label).toLocaleString()
                            }
                            formatter={(value) => [value.toFixed(4), "Loss"]}
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
                      <div className="no-data">No loss data available</div>
                    )}
                  </div>

                  <div className="chart-container full-width">
                    <h3>Perplexity <span className="epoch-indicator">Epoch {currentEpoch}</span></h3>
                    {globalData?.perplexity && globalData.perplexity.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={globalData.perplexity}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={formatTime} />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(label) =>
                              new Date(label).toLocaleString()
                            }
                            formatter={(value) => [value.toFixed(2), "Perplexity"]}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#ff7300"
                            fill="#ff9800"
                            name="Perplexity"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="no-data">No perplexity data available</div>
                    )}
                  </div>
                </div>

                <div className="stats-overview">
                  <div className="stat-overview-card">
                    <div className="stat-icon bandwidth-icon">📶</div>
                    <div className="stat-content">
                      <h3>Average Bandwidth</h3>
                      <p className="stat-value">
                        {globalData?.bandwidth && globalData.bandwidth.length > 0 ? `${avgBandwidth} MB/s` : "No data"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="stat-overview-card">
                    <div className="stat-icon tokens-icon">🚀</div>
                    <div className="stat-content">
                      <h3>Average Tokens/s</h3>
                      <p className="stat-value">
                        {globalData?.training_rate && globalData.training_rate.length > 0 ? `${avgTrainingRate} tok/s` : "No data"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="stat-overview-card">
                    <div className="stat-icon miners-icon">👨‍💻</div>
                    <div className="stat-content">
                      <h3>Active Miners</h3>
                      <p className="stat-value">
                        {globalData?.active_miners && globalData.active_miners.length > 0 ? activeMinersCount : "No data"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="stats">
                  <div className="stat-card">
                    <h3>Current Epoch</h3>
                    <p className="stat-value">
                      {globalData?.epochs && globalData.epochs.length > 0 ? currentEpoch : "No data"}
                    </p>
                  </div>
                  <div className="stat-card">
                    <h3>Current Loss</h3>
                    <p className="stat-value">
                      {globalData?.loss && globalData.loss.length > 0
                        ? globalData.loss[globalData.loss.length - 1]?.value?.toFixed(4) || "No data"
                        : "No data"}
                    </p>
                  </div>
                  <div className="stat-card">
                    <h3>Perplexity</h3>
                    <p className="stat-value">
                      {globalData?.perplexity && globalData.perplexity.length > 0
                        ? globalData.perplexity[globalData.perplexity.length - 1]?.value?.toFixed(2) || "No data"
                        : "No data"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

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
            
            {loading.minerData && (
              <div className="loading">Loading miner data...</div>
            )}
            
            {error.minerData && (
              <div className="error-message">{error.minerData}</div>
            )}
            
            {!loading.minerData && !error.minerData && minerData && (
              <div>
                <div className="miner-metrics">
                  <h3>Miner Metrics</h3>
                  <div className="metrics-grid">
                    <div className="metric-item">
                      <h4>Stake</h4>
                      <p>{minerData?.metagraph?.stake || 0} TAO</p>
                    </div>
                    <div className="metric-item">
                      <h4>Trust</h4>
                      <p>{minerData?.metagraph?.trust || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Consensus</h4>
                      <p>{minerData?.metagraph?.consensus || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Incentive</h4>
                      <p>{minerData?.metagraph?.incentive || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Emissions</h4>
                      <p>{minerData?.metagraph?.emissions || 0} τ/day</p>
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
                      <div className="no-data">No loss data available</div>
                    )}
                  </div>
                  
                  <div className="chart-container">
                    <h3>Incentive Over Time</h3>
                    {minerData?.incentive_timeseries && minerData.incentive_timeseries.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={minerData.incentive_timeseries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={formatTime} />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(label) => new Date(label).toLocaleString()}
                            formatter={(value) => [value.toFixed(4), 'Incentive']}
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
                      <div className="no-data">No incentive time-series data available</div>
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
                    <div className="no-data">No validator scores available</div>
                  )}
                </div>
              </div>
            )}
            
            {!loading.minerData && !minerData && !selectedMiner && miners.length > 0 && (
              <div className="no-miner-selected">
                <p>Select a miner to view detailed metrics</p>
              </div>
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
            if (activeTab === "global") fetchGlobalMetrics();
            else if (activeTab === "miners") fetchMiners();
            else if (activeTab === "allreduce") fetchAllReduceOperations();
            if (selectedMiner) fetchMinerData(selectedMiner);
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
