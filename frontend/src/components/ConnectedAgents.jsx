import React, { useState, useEffect } from 'react';
import { Laptop, RefreshCw, AlertCircle, ShieldAlert, Cpu } from 'lucide-react';
import { fetchWithRetry } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function ConnectedAgents({ jwt }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAgents = async () => {
    if (!jwt) return;
    try {
      const response = await fetchWithRetry(`${API_BASE}/agents/status`, {
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const data = await response.json();
      setAgents(data || []);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching connected agents:", err);
      setError("Cannot sync telemetry registry. Check backend connectivity.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000); // refresh every 5 seconds
    return () => clearInterval(interval);
  }, [jwt]);

  // Format date helper matching dashboard
  const formatTime = (timeStr) => {
    if (!timeStr) return 'Never';
    try {
      const date = new Date(timeStr);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return timeStr;
    }
  };

  const renderStatusBadge = (status) => {
    const isOnline = status === 'online';
    const dotColor = isOnline ? '#10B981' : '#8B95A8';
    const bgColor = isOnline ? 'rgba(16, 185, 129, 0.08)' : 'rgba(139, 149, 168, 0.08)';
    const borderColor = isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 149, 168, 0.15)';
    const label = isOnline ? 'ONLINE' : 'OFFLINE';

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '9999px',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        fontSize: '11px',
        fontWeight: '700',
        color: isOnline ? '#10B981' : '#8B95A8',
        whiteSpace: 'nowrap',
        letterSpacing: '0.05em'
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dotColor,
          boxShadow: isOnline ? '0 0 6px #10B981' : 'none'
        }} />
        {label}
      </span>
    );
  };

  return (
    <div className="dashboard-grid-v2">
      {/* Telemetry diagnostics header */}
      <div className="col-12" style={{
        background: '#0D1526',
        border: '1px solid #1C2942',
        borderRadius: '8px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: '#8B95A8',
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: '0 0 10px rgba(0, 217, 255, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D9FF', boxShadow: '0 0 8px #00D9FF' }} />
          <span>Active Ingestion Daemons: <strong style={{ color: '#00D9FF' }}>{agents.filter(a => a.status === 'online').length} Online</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '32px' }}>
          <span>Registered Agent PC Nodes: <strong style={{ color: '#E8EDF5' }}>{agents.length}</strong></span>
          <span>Offline Nodes: <strong style={{ color: '#8B95A8' }}>{agents.filter(a => a.status !== 'online').length}</strong></span>
        </div>
      </div>

      <div className="col-12">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>
              <Laptop size={18} style={{ color: '#00D9FF' }} />
              Agent Intranet Registry Directory
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={12} className="spin-slow" /> Polling Heartbeats
            </span>
          </div>

          {error ? (
            <div className="empty-state-container" style={{ padding: '40px 24px' }}>
              <AlertCircle size={32} style={{ color: 'var(--color-high)', marginBottom: '12px' }} />
              <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>Agent Registry Offline</h4>
              <p style={{ fontSize: '11px', color: '#8B95A8', marginTop: '4px' }}>{error}</p>
            </div>
          ) : loading && agents.length === 0 ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <div className="spinner"></div>
            </div>
          ) : agents.length === 0 ? (
            <div className="empty-state-container" style={{ padding: '60px 24px' }}>
              <ShieldAlert size={36} style={{ color: '#8B95A8', marginBottom: '12px' }} />
              <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>No Endpoint Agents Connected</h4>
              <p style={{ fontSize: '11px', color: '#8B95A8', marginTop: '4px' }}>Run `agent_collector.py` on client PCs to establish ingestion flow.</p>
            </div>
          ) : (
            <div className="alerts-table-container">
              <table className="alerts-table">
                <thead>
                  <tr>
                    <th>Hostname / PC</th>
                    <th>IP Address</th>
                    <th>Assigned User Profile</th>
                    <th>Ingestion Status</th>
                    <th>First Registered</th>
                    <th>Last Check-In</th>
                    <th>Total Logs Transmitted</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.agent_id} className={agent.status === 'online' ? '' : 'risk-low'} style={{ cursor: 'default' }}>
                      {/* Hostname */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className={`dept-avatar it`} style={{ width: '28px', height: '28px', fontSize: '10px' }}>
                            PC
                          </div>
                          <span style={{ fontWeight: 'bold', color: '#fff' }}>{agent.hostname}</span>
                        </div>
                      </td>

                      {/* IP */}
                      <td className="timestamp-text" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {agent.ip_address}
                      </td>

                      {/* Assigned User */}
                      <td>
                        {agent.assigned_user_id ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{agent.assigned_user_id}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#475569', fontStyle: 'italic' }}>Unmapped Endpoint</span>
                        )}
                      </td>

                      {/* Ingestion Status */}
                      <td>
                        {renderStatusBadge(agent.status)}
                      </td>

                      {/* First Registered */}
                      <td className="timestamp-text">
                        {formatTime(agent.first_seen)}
                      </td>

                      {/* Last Check-In */}
                      <td className="timestamp-text">
                        {formatTime(agent.last_seen)}
                      </td>

                      {/* Total Logs Sent */}
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: '#00D9FF' }}>
                        {agent.total_events_sent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
