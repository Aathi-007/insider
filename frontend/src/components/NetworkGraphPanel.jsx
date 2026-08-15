import React, { useState, useEffect } from 'react';
import { Network, AlertTriangle, ShieldCheck, RefreshCw, Cpu, Database, Server } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function NetworkGraphPanel({ jwt }) {
  const [communications, setCommunications] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [baselines, setBaselines] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Interactive States
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  // Poll telemetry data
  const fetchData = async () => {
    try {
      // Fetch communications, anomalies and baselines
      const [commsRes, anomsRes, baseRes] = await Promise.all([
        fetch(`${API_BASE}/network/communications`),
        fetch(`${API_BASE}/network/anomalies`),
        fetch(`${API_BASE}/network/baselines`)
      ]);

      if (!commsRes.ok || !anomsRes.ok || !baseRes.ok) {
        throw new Error("Failed to load network telemetry from server");
      }

      const commsData = await commsRes.json();
      const anomsData = await anomsRes.json();
      const baseData = await baseRes.json();

      setCommunications(commsData);
      setAnomalies(anomsData);
      setBaselines(baseData);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching network telemetry:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    
    // Dynamic style injection to avoid literal bracket compile issues in jsx
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      @keyframes pulse-red {
        0% { stroke-opacity: 0.4; stroke-width: 3; }
        50% { stroke-opacity: 1; stroke-width: 6; }
        100% { stroke-opacity: 0.4; stroke-width: 3; }
      }
      @keyframes dash-move {
        to { stroke-dashoffset: -20; }
      }
      .anomalous-line {
        animation: pulse-red 2s infinite ease-in-out;
      }
      .data-flow-anim {
        stroke-dasharray: 5, 5;
        animation: dash-move 1.5s linear infinite;
      }
      .node-circle {
        transition: all 0.3s ease;
        cursor: pointer;
      }
      .node-circle:hover {
        transform: scale(1.15);
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      clearInterval(interval);
      document.head.removeChild(styleEl);
    };
  }, []);

  // 1. Static 12 internal servers configuration
  const servers = [
    { id: "SERVER_HR_01", dept: "HR" },
    { id: "SERVER_HR_PORTAL", dept: "HR" },
    { id: "SERVER_FINANCE_DB", dept: "Finance" },
    { id: "SERVER_PAYROLL", dept: "Finance" },
    { id: "SERVER_ENG_BUILD", dept: "Engineering" },
    { id: "SERVER_ENG_CODE", dept: "Engineering" },
    { id: "SERVER_ENG_TEST", dept: "Engineering" },
    { id: "SERVER_IT_ACTIVE_DIRECTORY", dept: "IT" },
    { id: "SERVER_IT_MONITOR", dept: "IT" },
    { id: "SERVER_SALES_CRM", dept: "Sales" },
    { id: "SERVER_SALES_PORTAL", dept: "Sales" },
    { id: "SERVER_HQ_NAS", dept: "Executive" }
  ];

  // Node position mapping (Circular layout)
  const cx = 350;
  const cy = 250;
  const radius = 175;
  const nodeCoords = {};
  
  servers.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / servers.length;
    nodeCoords[node.id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle: angle,
      ...node
    };
  });

  // Department colors mapping
  const getDeptColor = (dept) => {
    switch (dept) {
      case "HR": return "#EC4899"; // pink
      case "Finance": return "#10B981"; // emerald green
      case "Engineering": return "#3B82F6"; // blue
      case "IT": return "#A855F7"; // purple
      case "Sales": return "#F59E0B"; // orange
      case "Executive": return "#FBBF24"; // amber
      default: return "#94A3B8";
    }
  };

  // Build aggregated link lines between servers
  const links = [];
  const linkKeySet = new Set();

  communications.forEach(comm => {
    const { source_server, destination_server, is_anomaly, data_transferred_mb } = comm;
    
    // Check nodes existence
    if (!nodeCoords[source_server] || !nodeCoords[destination_server]) return;

    // Filter normal links if anomalies only filter is active
    if (showAnomaliesOnly && !is_anomaly) return;

    // Sort IDs to avoid drawing double duplicate lines (e.g. A->B and B->A on top of each other)
    const sortedIds = [source_server, destination_server].sort();
    const linkKey = `${sortedIds[0]}<->${sortedIds[1]}`;

    if (!linkKeySet.has(linkKey)) {
      linkKeySet.add(linkKey);
      links.push({
        key: linkKey,
        source: source_server,
        target: destination_server,
        sourceCoords: nodeCoords[source_server],
        targetCoords: nodeCoords[destination_server],
        isAnomaly: is_anomaly,
        dataTransferred: data_transferred_mb
      });
    } else {
      // If aggregate exists, ensure we flag isAnomaly if any sub-connection is anomalous
      const existingLink = links.find(l => l.key === linkKey);
      if (existingLink && is_anomaly) {
        existingLink.isAnomaly = true;
      }
    }
  });

  if (loading && communications.length === 0) {
    return (
      <div className="dashboard-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="spin-slow" size={32} style={{ color: 'var(--color-info)', marginBottom: '16px' }} />
          <p style={{ color: '#8B95A8' }}>Loading server communications telemetry...</p>
        </div>
      </div>
    );
  }

  // Find info about hovered or selected node
  const activeNodeId = hoveredNode || selectedNode;
  const activeNodeInfo = activeNodeId ? nodeCoords[activeNodeId] : null;

  // Filter logs for selected server
  const activeNodeLogs = activeNodeId 
    ? communications.filter(c => c.source_server === activeNodeId || c.destination_server === activeNodeId)
    : [];

  return (
    <div className="dashboard-grid-v2" style={{ gap: '24px' }}>
      


      {/* 1. Node-Link SVG Graph viewport Card */}
      <div className="col-8" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="dashboard-card" style={{ height: '100%', position: 'relative' }}>
          <div className="dashboard-card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '14px' }}>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={20} style={{ color: '#6366F1' }} />
                Server Communication Network Graph
              </h2>
              <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                Visualizes real-time server-to-server data transfers. Anomalous links indicate novel unbaselined connections.
              </p>
            </div>
            
            {/* Filter Toggle Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="export-btn"
                style={{
                  background: !showAnomaliesOnly ? 'rgba(99,102,241,0.1)' : 'transparent',
                  borderColor: !showAnomaliesOnly ? '#6366F1' : 'rgba(255,255,255,0.1)',
                  color: !showAnomaliesOnly ? '#818CF8' : '#8B95A8'
                }}
                onClick={() => setShowAnomaliesOnly(false)}
              >
                All Connections
              </button>
              <button 
                className="export-btn"
                style={{
                  background: showAnomaliesOnly ? 'rgba(239,68,68,0.1)' : 'transparent',
                  borderColor: showAnomaliesOnly ? '#EF4444' : 'rgba(255,255,255,0.1)',
                  color: showAnomaliesOnly ? '#F87171' : '#8B95A8'
                }}
                onClick={() => setShowAnomaliesOnly(true)}
              >
                Anomalies Only
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '16px' }}>
            <svg viewBox="0 0 700 500" width="100%" height="450px" style={{ background: '#070a13', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
              
              {/* SVG Filters for glowing effect */}
              <defs>
                <filter id="glow-normal" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-anomaly" x="-35%" y="-35%" width="170%" height="170%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#EF4444" floodOpacity="0.8" />
                </filter>
              </defs>

              {/* Draw link lines */}
              <g>
                {links.map((link) => {
                  const isHovered = hoveredLink === link.key;
                  const opacity = hoveredNode 
                    ? (link.source === hoveredNode || link.target === hoveredNode ? 1 : 0.15)
                    : selectedNode 
                    ? (link.source === selectedNode || link.target === selectedNode ? 1 : 0.15)
                    : 1;

                  if (link.isAnomaly) {
                    return (
                      <g key={link.key} style={{ transition: 'opacity 0.3s', opacity }}>
                        {/* Glowing anomalous line */}
                        <line
                          x1={link.sourceCoords.x}
                          y1={link.sourceCoords.y}
                          x2={link.targetCoords.x}
                          y2={link.targetCoords.y}
                          stroke="#EF4444"
                          strokeWidth={isHovered ? 6 : 4}
                          className="anomalous-line"
                          filter="url(#glow-anomaly)"
                          onMouseEnter={() => setHoveredLink(link.key)}
                          onMouseLeave={() => setHoveredLink(null)}
                        />
                        {/* Dashing stream exfiltration animation */}
                        <line
                          x1={link.sourceCoords.x}
                          y1={link.sourceCoords.y}
                          x2={link.targetCoords.x}
                          y2={link.targetCoords.y}
                          stroke="#F87171"
                          strokeWidth="1.5"
                          className="data-flow-anim"
                          pointerEvents="none"
                        />
                      </g>
                    );
                  } else {
                    return (
                      <line
                        key={link.key}
                        x1={link.sourceCoords.x}
                        y1={link.sourceCoords.y}
                        x2={link.targetCoords.x}
                        y2={link.targetCoords.y}
                        stroke={isHovered ? "#38BDF8" : "rgba(148, 163, 184, 0.25)"}
                        strokeWidth={isHovered ? 3 : 1.5}
                        style={{ transition: 'opacity 0.3s, stroke 0.3s', opacity }}
                        onMouseEnter={() => setHoveredLink(link.key)}
                        onMouseLeave={() => setHoveredLink(null)}
                      />
                    );
                  }
                })}
              </g>

              {/* Draw server nodes */}
              <g>
                {servers.map((node) => {
                  const coords = nodeCoords[node.id];
                  const isHovered = hoveredNode === node.id;
                  const isSelected = selectedNode === node.id;
                  const color = getDeptColor(node.dept);
                  
                  // Dim non-connected nodes if something is hovered/selected
                  let opacity = 1;
                  if (activeNodeId) {
                    const isConnected = communications.some(
                      c => (c.source_server === activeNodeId && c.destination_server === node.id) ||
                           (c.destination_server === activeNodeId && c.source_server === node.id)
                    );
                    opacity = (node.id === activeNodeId || isConnected) ? 1 : 0.2;
                  }

                  // Label rotation adjustments
                  const textAnchor = coords.x > cx ? "start" : "end";
                  const textXOffset = coords.x > cx ? 20 : -20;
                  const textYOffset = 4;

                  return (
                    <g 
                      key={node.id} 
                      style={{ transition: 'opacity 0.3s', opacity }}
                      onClick={() => setSelectedNode(isSelected ? null : node.id)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      {/* Node halo ring */}
                      {(isHovered || isSelected) && (
                        <circle
                          cx={coords.x}
                          cy={coords.y}
                          r={isSelected ? 22 : 18}
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                          strokeDasharray="4, 2"
                          className="spin-slow"
                        />
                      )}
                      
                      {/* Node central circle */}
                      <circle
                        cx={coords.x}
                        cy={coords.y}
                        r={isSelected ? 14 : 10}
                        fill="#0B1120"
                        stroke={color}
                        strokeWidth={isSelected ? 4 : 2.5}
                        className="node-circle"
                      />

                      {/* Server label text */}
                      <text
                        x={coords.x + textXOffset}
                        y={coords.y + textYOffset}
                        textAnchor={textAnchor}
                        fill={(isHovered || isSelected) ? "#fff" : "#8B95A8"}
                        fontSize={(isHovered || isSelected) ? "11px" : "10px"}
                        fontWeight={(isHovered || isSelected) ? "bold" : "600"}
                        style={{ userSelect: 'none', transition: 'fill 0.2s', pointerEvents: 'none' }}
                      >
                        {node.id.replace("SERVER_", "")}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Interactive Server Inspector Panel (Right Column) */}
      <div className="col-4" style={{ display: 'flex', flexDirection: 'column' }}>
        
        {activeNodeInfo ? (
          /* Server Drilldown view */
          <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="dashboard-card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '6px',
                  background: 'rgba(99,102,241,0.08)',
                  color: getDeptColor(activeNodeInfo.dept)
                }}>
                  <Server size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold' }}>{activeNodeInfo.id}</h3>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {activeNodeInfo.dept} Department
                  </span>
                </div>
              </div>
            </div>

            {/* Baseline Profile partners check */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8', display: 'block', marginBottom: '8px' }}>
                BASELINE DEPLOYMENT PROFILE
              </label>
              <div style={{ padding: '12px', background: '#0a0d16', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ fontSize: '10px', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                  Known Communication Partners:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {baselines[activeNodeInfo.id] && baselines[activeNodeInfo.id].length > 0 ? (
                    baselines[activeNodeInfo.id].map(partner => (
                      <span 
                        key={partner} 
                        className="reason-pill" 
                        style={{
                          background: 'rgba(16,185,129,0.08)',
                          color: '#10B981',
                          border: '1px solid rgba(16,185,129,0.15)',
                          fontSize: '9.5px',
                          fontWeight: 'bold'
                        }}
                      >
                        {partner.replace("SERVER_", "")}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '11px', color: '#EF4444' }}>No baseline established.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Check if this server is involved in any active anomalies */}
            {anomalies.some(a => a.source_server === activeNodeInfo.id || a.destination_server === activeNodeInfo.id) && (
              <div style={{
                padding: '12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: '6px',
                display: 'flex',
                gap: '10px'
              }}>
                <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#EF4444', margin: 0 }}>
                    Novel Connection Detected
                  </h4>
                  <p style={{ fontSize: '11px', color: '#F87171', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                    Communications logged with server outside established baseline. Flagged: <strong>+25 Risk Points</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Recent logs list */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8', display: 'block', marginBottom: '8px' }}>
                RECENT NETWORK TRANSLOGS
              </label>
              <div style={{
                flexGrow: 1,
                overflowY: 'auto',
                maxHeight: '200px',
                background: '#060814',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.03)',
                padding: '8px'
              }}>
                {activeNodeLogs.length === 0 ? (
                  <p style={{ color: '#64748B', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
                    No communications logged in current timeframe.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {activeNodeLogs.map((log) => {
                      const isSrc = log.source_server === activeNodeInfo.id;
                      const partner = isSrc ? log.destination_server : log.source_server;
                      return (
                        <div 
                          key={log.comm_id} 
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            fontSize: '11px'
                          }}
                        >
                          <div>
                            <span style={{ color: isSrc ? '#3B82F6' : '#EC4899', fontWeight: 'bold' }}>
                              {isSrc ? "→ OUT" : "← IN"}
                            </span>
                            <span style={{ color: '#fff', marginLeft: '6px' }}>
                              {partner.replace("SERVER_", "")}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ color: log.is_anomaly ? '#EF4444' : '#8B95A8', fontWeight: 'bold' }}>
                              {log.data_transferred_mb} MB
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button 
              className="export-btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setSelectedNode(null)}
            >
              Clear Selection
            </button>
          </div>
        ) : (
          /* General Summary view */
          <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="dashboard-card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>Network Diagnostics</h3>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#0a0d16', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '9px', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Active Nodes</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#6366F1', display: 'block', marginTop: '4px' }}>12 / 12</span>
              </div>
              <div style={{ background: '#0a0d16', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '9px', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Anomalous Links</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: anomalies.length > 0 ? '#EF4444' : '#10B981', display: 'block', marginTop: '4px' }}>
                  {anomalies.length} Alerts
                </span>
              </div>
            </div>

            {/* List of active anomalies */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8', display: 'block', marginBottom: '8px' }}>
                FLAGGED ANOMALIES REGISTER
              </label>
              
              <div style={{
                flexGrow: 1,
                overflowY: 'auto',
                background: '#060814',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.03)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {anomalies.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748B' }}>
                    <ShieldCheck size={28} style={{ color: '#10B981', marginBottom: '10px' }} />
                    <p style={{ fontSize: '11px' }}>All server pathways baselined and secure. No anomalies detected.</p>
                  </div>
                ) : (
                  anomalies.map((anom) => (
                    <div 
                      key={anom.comm_id}
                      style={{
                        padding: '10px',
                        background: 'rgba(239,68,68,0.03)',
                        border: '1px solid rgba(239,68,68,0.1)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedNode(anom.source_server)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={10} /> Novel Connection
                        </span>
                        <span style={{ fontSize: '10px', color: '#8B95A8' }}>
                          {new Date(anom.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold', marginTop: '6px' }}>
                        {anom.source_server.replace("SERVER_", "")} → {anom.destination_server.replace("SERVER_", "")}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748B', marginTop: '6px' }}>
                        <span>Payload: {anom.data_transferred_mb} MB</span>
                        <span style={{ color: '#EF4444', fontWeight: 'bold' }}>+25 pts</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <p style={{ fontSize: '10px', color: '#64748B', lineHeight: '1.4', margin: 0 }}>
              💡 Click on any server node in the graph viewport to inspect its specific traffic baselines and logs history.
            </p>
          </div>
        )}
      </div>
      
    </div>
  );
}
