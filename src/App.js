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

// API base URL - change this to your FastAPI server URL
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

// Calculate averages
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

  // Data state
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

  // Fetch global metrics
  useEffect(() => {
    if (activeTab === "global") {
      fetchGlobalMetrics();
    }
  }, [activeTab, fetchGlobalMetrics]);

  // Fetch miners list
  useEffect(() => {
    if (activeTab === "miners") {
      fetchMiners();
    }
  }, [activeTab, fetchMiners]);

  // Fetch allreduce operations
  useEffect(() => {
    if (activeTab === "allreduce") {
      fetchAllReduceOperations();
    }
  }, [activeTab, fetchAllReduceOperations]);

  // Fetch miner data when selected
  useEffect(() => {
    if (selectedMiner) {
      fetchMinerData(selectedMiner);
    }
  }, [selectedMiner, fetchMinerData]);

  const fetchGlobalMetrics = useCallback(async () => {
    setLoading({ ...loading, global: true });
    setError({ ...error, global: null });
  
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/global`);
      setGlobalData(response.data);
    } catch (err) {
      console.error("Error fetching global metrics:", err);
      setError({ ...error, global: "Failed to load global metrics" });
      
      // Use dummy data as fallback
      setGlobalData({
        epochs: generateDummyData(24, 10, 0.1),
        loss: generateDummyData(24, 3.5, 0.5, true),
        perplexity: generateDummyData(24, 15, 3, true),
        training_rate: generateDummyData(24, 120, 30),
        bandwidth: generateDummyData(24, 25, 5),
        active_miners: generateDummyData(24, 42, 8)
      });
    } finally {
      setLoading({ ...loading, global: false });
    }
  }, [loading, error, generateDummyData]);

  const fetchMiners = useCallback(async () => {
    setLoading({ ...loading, miners: true });
    setError({ ...error, miners: null });
  
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/miners`);
      setMiners(response.data.map(uid => ({
        value: uid.toString(),
        label: `Miner ${uid}`
      })));
    } catch (err) {
      console.error("Error fetching miners:", err);
      setError({ ...error, miners: "Failed to load miners list" });
      
      // Use dummy miners as fallback
      setMiners(Array.from({ length: 20 }, (_, i) => ({
        value: i.toString(),
        label: `Miner ${i}`
      })));
    } finally {
      setLoading({ ...loading, miners: false });
    }
  }, [loading, error]);

  const fetchMinerData = useCallback(async (uid) => {
    setLoading({ ...loading, minerData: true });
    setError({ ...error, minerData: null });
  
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/miner/${uid}`);
      setMinerData(response.data);
    } catch (err) {
      console.error(`Error fetching data for miner ${uid}:`, err);
      setError({ ...error, minerData: `Failed to load data for miner ${uid}` });
      
      // Use dummy miner data as fallback
      setMinerData(generateDummyMinerData(uid));
    } finally {
      setLoading({ ...loading, minerData: false });
    }
  }, [loading, error, generateDummyMinerData]);

  const fetchAllReduceOperations = useCallback(async () => {
    setLoading({ ...loading, allreduce: true });
    setError({ ...error, allreduce: null });
  
    try {
      const response = await axios.get(`${API_BASE_URL}/metrics/allreduce`);
      setAllReduceOperations(response.data);
    } catch (err) {
      console.error("Error fetching AllReduce operations:", err);
      setError({ ...error, allreduce: "Failed to load AllReduce operations" });
      
      // Use dummy allreduce operations as fallback
      setAllReduceOperations(generateDummyAllReduceOperations());
    } finally {
      setLoading({ ...loading, allreduce: false });
    }
  }, [loading, error, generateDummyAllReduceOperations]);

  const handleMinerSelect = (uid) => {
    setSelectedMiner(uid);
  };

  // Calculate key metrics
  const avgBandwidth = getAverage(globalData.bandwidth).toFixed(2);
  const avgTrainingRate = getAverage(globalData.training_rate).toFixed(0);
  const activeMinersCount = globalData.active_miners.length > 0 
    ? globalData.active_miners[globalData.active_miners.length - 1].value.toFixed(0) 
    : "0";
  const currentEpoch = globalData.epochs.length > 0 
    ? Math.max(...globalData.epochs.map(d => d.value))
    : "0";
  
  // Helper functions to generate fallback data if API fails
  const generateDummyData = useCallback((
    hours = 24,
    baseValue = 0,
    variance = 1,
    decreasing = false
  ) => {
    const now = new Date();
    return Array.from({ length: hours }, (_, i) => {
      const time = new Date(now.getTime() - (hours - i) * 3600000).toISOString();
      let value;
      if (decreasing) {
        value =
          baseValue + variance * Math.cos(i / 5) - (i / hours) * variance * 3;
      } else {
        value =
          baseValue + variance * Math.sin(i / 5) + (i / hours) * variance * 0.5;
      }
      return { time, value: Math.max(0, value) };
    });
  }, []);
  
  const generateDummyMinerData = useCallback((uid) => {
    return {
      metagraph: {
        stake: parseFloat((Math.random() * 100).toFixed(2)),
        trust: parseFloat((Math.random() * 1).toFixed(3)),
        consensus: parseFloat((Math.random() * 1).toFixed(3)),
        incentive: parseFloat((Math.random() * 1).toFixed(3)),
        emissions: parseFloat((Math.random() * 10).toFixed(2)),
      },
      training: {
        loss: generateDummyData(24, 3.2, 0.8, true),
        inner_step: generateDummyData(24, 50, 20),
        samples_accumulated: generateDummyData(24, 500, 100),
      },
      resources: {
        cpu_percent: generateDummyData(24, 60, 15),
        memory_percent: generateDummyData(24, 45, 10),
        gpu_utilization: generateDummyData(24, 85, 15),
      },
      scores: Array.from({ length: 5 }, (_, i) => ({
        validator_uid: i,
        train_score: parseFloat((Math.random() * 0.8 + 0.2).toFixed(4)),
        all_reduce_score: parseFloat((Math.random() * 0.8 + 0.2).toFixed(4)),
        total_score: parseFloat((Math.random() * 0.8 + 0.2).toFixed(4)),
      })),
    };
  }, [generateDummyData]);
  
  const generateDummyAllReduceOperations = useCallback(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const time = new Date(Date.now() - i * 3600000 * 4).toISOString();
      return {
        operation_id: `op-${i}`,
        epoch: 10 - i,
        time,
        metrics: {
          duration: parseFloat((Math.random() * 20 + 10).toFixed(2)),
          participating_miners: Math.floor(Math.random() * 15 + 10),
          success_rate: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)),
          bandwidth: parseFloat((Math.random() * 10 + 20).toFixed(2)),
        }
      };
    });
  }, []);

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
                  </div>

                  <div className="chart-container full-width">
                    <h3>Perplexity <span className="epoch-indicator">Epoch {currentEpoch}</span></h3>
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
                  </div>
                </div>

                <div className="stats-overview">
                  <div className="stat-overview-card">
                    <div className="stat-icon bandwidth-icon">📶</div>
                    <div className="stat-content">
                      <h3>Average Bandwidth</h3>
                      <p className="stat-value">{avgBandwidth} MB/s</p>
                    </div>
                  </div>
                  
                  <div className="stat-overview-card">
                    <div className="stat-icon tokens-icon">🚀</div>
                    <div className="stat-content">
                      <h3>Average Tokens/s</h3>
                      <p className="stat-value">{avgTrainingRate} tok/s</p>
                    </div>
                  </div>
                  
                  <div className="stat-overview-card">
                    <div className="stat-icon miners-icon">👨‍💻</div>
                    <div className="stat-content">
                      <h3>Active Miners</h3>
                      <p className="stat-value">{activeMinersCount}</p>
                    </div>
                  </div>
                </div>

                <div className="stats">
                  <div className="stat-card">
                    <h3>Current Epoch</h3>
                    <p className="stat-value">{currentEpoch}</p>
                  </div>
                  <div className="stat-card">
                    <h3>Current Loss</h3>
                    <p className="stat-value">
                      {globalData.loss.length > 0
                        ? globalData.loss[globalData.loss.length - 1].value.toFixed(4)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="stat-card">
                    <h3>Perplexity</h3>
                    <p className="stat-value">
                      {globalData.perplexity.length > 0
                        ? globalData.perplexity[globalData.perplexity.length - 1].value.toFixed(2)
                        : "N/A"}
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
            ) : (
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
                      <p>{minerData.metagraph?.stake || 0} TAO</p>
                    </div>
                    <div className="metric-item">
                      <h4>Trust</h4>
                      <p>{minerData.metagraph?.trust || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Consensus</h4>
                      <p>{minerData.metagraph?.consensus || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Incentive</h4>
                      <p>{minerData.metagraph?.incentive || 0}</p>
                    </div>
                    <div className="metric-item">
                      <h4>Emissions</h4>
                      <p>{minerData.metagraph?.emissions || 0} τ/day</p>
                    </div>
                  </div>
                </div>
                
                <div className="charts">
                  <div className="chart-container">
                    <h3>Training Loss</h3>
                    {minerData.training?.loss ? (
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
                    <h3>GPU Utilization</h3>
                    {minerData.resources?.gpu_utilization ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={minerData.resources.gpu_utilization}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tickFormatter={formatTime} />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(label) => new Date(label).toLocaleString()}
                            formatter={(value) => [value.toFixed(2), '%']} 
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#82ca9d"
                            fill="#82ca9d"
                            fillOpacity={0.3}
                            name="GPU Utilization"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="no-data">No GPU utilization data available</div>
                    )}
                  </div>
                </div>
                
                <div className="validator-scores">
                  <h3>Validator Scores</h3>
                  {minerData.scores && Object.keys(minerData.scores).length > 0 ? (
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
                            <td>{(scores.train_score || 0).toFixed(4)}</td>
                            <td>{(scores.all_reduce_score || 0).toFixed(4)}</td>
                            <td>{(scores.total_score || 0).toFixed(4)}</td>
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
            
            {!loading.minerData && !minerData && !selectedMiner && (
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
                          <tr key={op.operation_id}>
                            <td>{new Date(op.time).toLocaleString()}</td>
                            <td>{op.epoch}</td>
                            <td>{op.metrics?.duration?.toFixed(2) || 'N/A'}</td>
                            <td>{op.metrics?.participating_miners || 'N/A'}</td>
                            <td>
                              {op.metrics?.success_rate ? (
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
                            <td>{op.metrics?.bandwidth?.toFixed(2) || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">No AllReduce operations recorded</div>
                  )}
                </div>
                
                {allReduceOperations.length > 0 && (
                  <div className="charts">
                    <div className="chart-container">
                      <h3>Success Rate Trend</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart 
                          data={allReduceOperations.slice().reverse().map(op => ({
                            time: op.time,
                            value: op.metrics?.success_rate || 0
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
                            time: op.time,
                            value: op.metrics?.duration || 0
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
                )}
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
