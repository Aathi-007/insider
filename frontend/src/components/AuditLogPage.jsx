import React, { useState } from 'react';
import { Clock, Download, Search, Shield, RefreshCw } from 'lucide-react';

export default function AuditLogPage({ alerts, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Parser logic to extract audit events from alerts notes history
  const parseAuditLogs = (alertsList) => {
    const logs = [];
    alertsList.forEach(alert => {
      if (!alert.analyst_notes) return;
      
      const lines = alert.analyst_notes.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        const match = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (match) {
          const timestamp = match[1];
          const text = match[2];
          
          let action = 'Comment Added';
          let details = text;
          let analyst = alert.assigned_to_analyst || 'Analyst_1';
          
          if (text.startsWith('Assigned to ')) {
            action = 'Alert Assigned';
            const parsedAnalyst = text.substring('Assigned to '.length);
            analyst = parsedAnalyst || analyst;
            details = `Alert assigned to ${analyst}`;
          } else if (text.startsWith('Escalated to ')) {
            action = 'Alert Escalated';
            details = text;
          } else if (text.startsWith('Resolution (')) {
            action = 'Alert Resolved';
            details = text;
          }
          
          logs.push({
            timestamp,
            alertId: alert.risk_event_id,
            user: `${alert.user_name} (${alert.user_id})`,
            action,
            analyst,
            details
          });
        }
      });
    });
    
    // Sort newest first
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const logs = parseAuditLogs(alerts);

  // Filter logs by search query
  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    return (
      log.alertId.toString().includes(q) ||
      log.user.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.analyst.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Alert ID', 'Target Profile', 'Action Taken', 'Analyst', 'Details'];
    const rows = filteredLogs.map(l => [
      l.timestamp,
      l.alertId,
      l.user.replace(/"/g, '""'),
      l.action,
      l.analyst,
      l.details.replace(/"/g, '""')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `UEBA_SOC_AuditLog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderActionBadge = (action) => {
    let dotColor = '#3B82F6';
    let bgColor = 'rgba(59, 130, 246, 0.08)';
    let borderColor = 'rgba(59, 130, 246, 0.15)';
    
    if (action === 'Alert Assigned') {
      dotColor = '#F59E0B';
      bgColor = 'rgba(245, 158, 11, 0.08)';
      borderColor = 'rgba(245, 158, 11, 0.15)';
    } else if (action === 'Alert Escalated') {
      dotColor = '#A855F7';
      bgColor = 'rgba(168, 85, 247, 0.08)';
      borderColor = 'rgba(168, 85, 247, 0.15)';
    } else if (action === 'Alert Resolved') {
      dotColor = '#10B981';
      bgColor = 'rgba(16, 185, 129, 0.08)';
      borderColor = 'rgba(16, 185, 129, 0.15)';
    }
    
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '9999px',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        fontSize: '11px',
        fontWeight: '600',
        color: '#E8EDF5',
        whiteSpace: 'nowrap'
      }}>
        <span style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: dotColor
        }} />
        {action}
      </span>
    );
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h2>
          <Clock size={18} style={{ color: 'var(--color-info)' }} />
          SOC Operations Audit Log Trail
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="export-btn" onClick={onRefresh} style={{ padding: '4px 10px', fontSize: '11px' }}>
            <RefreshCw size={11} /> Sync Logs
          </button>
          <button 
            className="export-btn" 
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      <div className="table-toolbar" style={{ margin: '16px 0' }}>
        <div className="search-input-wrapper" style={{ width: '100%', maxWidth: '400px' }}>
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search audit trail (ID, profile, action)..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="alerts-table-container">
        {filteredLogs.length === 0 ? (
          <div className="no-data">
            <p>No audit trail logs logged.</p>
          </div>
        ) : (
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Alert ID</th>
                <th>Target Profile</th>
                <th>Action Taken</th>
                <th>Analyst Assigned</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr key={index}>
                  <td className="timestamp-text" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>#{log.alertId}</td>
                  <td>{log.user}</td>
                  <td>
                    {renderActionBadge(log.action)}
                  </td>
                  <td style={{ color: '#fff', fontWeight: 'bold' }}>{log.analyst}</td>
                  <td style={{ color: '#94a3b8', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
