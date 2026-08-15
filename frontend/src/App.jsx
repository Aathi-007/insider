import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Download, Clock, AlertCircle, BarChart2, ListTodo, Users2, LayoutDashboard, Settings, ShieldCheck } from 'lucide-react';
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';

import SummaryCards from './components/SummaryCards';
import TeamBehaviorOverview from './components/TeamBehaviorOverview';
import AlertsTable from './components/AlertsTable';
import UserDetailModal from './components/UserDetailModal';
import RiskTrendChart from './components/RiskTrendChart';
import RequestTrackerChart from './components/RequestTrackerChart';
import ActivityTimeline from './components/ActivityTimeline';
import UserDirectory from './components/UserDirectory';

import RuleAccuracyPanel from './components/RuleAccuracyPanel';
import DepartmentHeatmap from './components/DepartmentHeatmap';
import AuditLogPage from './components/AuditLogPage';
import AdminPanel from './components/AdminPanel';
import CrossDeptThreatMatrix from './components/CrossDeptThreatMatrix';
import SocAgentActivity from './components/SocAgentActivity';
import RuleTuningAdvisor from './components/RuleTuningAdvisor';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

const styleContent = `
  .app-layout {
    display: flex;
    min-height: 100vh;
    background: #0B1120;
  }
  .sidebar {
    width: 240px;
    background: #0F1729;
    border-right: 1px solid #2A3548;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    gap: 32px;
    flex-shrink: 0;
  }
  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
    padding: 0 8px;
  }
  .sidebar-menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #8B95A8;
    text-decoration: none;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: bold;
    transition: all 0.2s;
  }
  .sidebar-link:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.02);
  }
  .sidebar-link.active {
    color: #6366F1;
    background: rgba(99, 102, 241, 0.08);
    border-left: 3px solid #6366F1;
    border-radius: 0 6px 6px 0;
    padding-left: 9px;
  }
  .main-content {
    flex-grow: 1;
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-sizing: border-box;
  }
`;

export default function App() {
  const [jwt, setJwt] = useState('bypass-login');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  
  // State for live clock in header
  const [currentTime, setCurrentTime] = useState(new Date());

  // Polling Alerts Data in App.jsx to synchronize all charts and grids
  const fetchAlerts = async () => {
    if (!jwt) return;
    try {
      const response = await fetch(`${API_BASE}/alerts`, {
        headers: { 
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const data = await response.json();
      setAlerts(data);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error polling alerts in App:", err);
      setError("Cannot connect to server - is the backend running?");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [jwt]);

  // Update live clock every second
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockTimer);
  }, []);

  // Report Export Feature: Downloads active alerts array as a JSON file
  const handleExportReport = () => {
    if (alerts.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(alerts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `UEBA_SOC_Report_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const dashboardView = (
    <div className="dashboard-grid-v2">
      {/* Row 1: SummaryCards spans 12 columns */}
      <div className="col-12">
        <SummaryCards onFetchError={setError} jwt={jwt} />
      </div>

      {/* Row 2: AlertsTable (full-width below) */}
      <div className="col-12">
        <AlertsTable 
          alerts={alerts}
          loading={loading}
          error={error}
          onRowClick={setSelectedUserId}
          jwt={jwt}
          onRefresh={fetchAlerts}
        />
      </div>

      {/* Row 3: Two-column row: RiskTrendChart and DepartmentHeatmap (equal height, equal width, side by side) */}
      <div className="col-6" style={{ minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
        <RiskTrendChart alerts={alerts} />
      </div>
      <div className="col-6" style={{ minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
        <DepartmentHeatmap alerts={alerts} />
      </div>

      {/* Row 4: TeamBehaviorOverview spans 12 columns */}
      <div className="col-12">
        <TeamBehaviorOverview alerts={alerts} jwt={jwt} />
      </div>

      {/* Row 5: Two-column row: ActivityTimeline and RequestTrackerChart (side by side, equal height) */}
      <div className="col-6" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
        <ActivityTimeline alerts={alerts} onRowClick={setSelectedUserId} />
      </div>
      <div className="col-6" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
        <RequestTrackerChart jwt={jwt} />
      </div>
    </div>
  );

  // Compute resolved alert metrics for Resolved Alerts summary cards
  const resolvedAlerts = alerts.filter(a => a.status && a.status.startsWith('resolved'));
  const fpCount = resolvedAlerts.filter(a => a.status === 'resolved_false_positive').length;
  const threatCount = resolvedAlerts.filter(a => a.status === 'resolved_confirmed_threat').length;

  const resolvedView = (
    <div className="dashboard-grid-v2">
      {/* Row 1: Summary cards row (2 cards: False Positives, Confirmed Threats - side by side, equal width) */}
      <div className="col-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="summary-card total" style={{ width: '100%' }}>
          <div className="summary-icon-container" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="summary-info">
            <span className="summary-label">Resolved False Positives</span>
            <div className="summary-value-wrapper">
              <span className="summary-value" style={{ color: '#10B981' }}>{fpCount}</span>
              <span className="summary-trend" style={{ color: '#10B981' }}>Closed Clean</span>
            </div>
          </div>
        </div>
      </div>

      <div className="col-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="summary-card high" style={{ width: '100%' }}>
          <div className="summary-icon-container" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
            <ShieldAlert size={24} />
          </div>
          <div className="summary-info">
            <span className="summary-label">Resolved Confirmed Threats</span>
            <div className="summary-value-wrapper">
              <span className="summary-value" style={{ color: '#EF4444' }}>{threatCount}</span>
              <span className="summary-trend" style={{ color: '#EF4444' }}>Mitigated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: RuleAccuracyPanel (radar chart + table) full width below */}
      <div className="col-12">
        <RuleAccuracyPanel jwt={jwt} />
      </div>

      {/* Row 3: Resolved alerts table full width below that */}
      <div className="col-12">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>
              <ShieldCheck size={18} style={{ color: 'var(--color-low)' }} />
              Closed Resolution Registry
            </h2>
          </div>
          <AlertsTable 
            alerts={resolvedAlerts}
            loading={loading}
            error={error}
            onRowClick={setSelectedUserId}
            jwt={jwt}
            onRefresh={fetchAlerts}
          />
        </div>
      </div>
    </div>
  );

  return (
    <Router>
      <style>{styleContent}</style>
      <div className="app-layout">
        
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <ShieldAlert size={22} style={{ color: 'var(--color-high)' }} />
            <span>SOC Insider Threat</span>
          </div>

          <nav className="sidebar-menu">
            <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} />
              <span>All Alerts</span>
            </NavLink>

            <NavLink to="/resolved" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={16} />
              <span>Resolved Alerts</span>
            </NavLink>
            
            <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <ListTodo size={16} />
              <span>Audit Log</span>
            </NavLink>
            
            <NavLink to="/accuracy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <BarChart2 size={16} />
              <span>Rule Accuracy</span>
            </NavLink>
            
            <NavLink to="/heatmap" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Users2 size={16} />
              <span>Dept Heatmap</span>
            </NavLink>
            
            <NavLink to="/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Settings size={16} />
              <span>Admin Panel</span>
            </NavLink>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <header className="dashboard-header" style={{ marginBottom: 0 }}>
            <div className="header-titles">
              <h1>
                <ShieldAlert size={28} style={{ color: 'var(--color-high)' }} />
                Insider Threat Console
              </h1>
              <p>Real-time User Entity Behavior Analytics & SOC Monitoring Command</p>
            </div>
            
            <div className="header-actions">
              <div className="live-clock">
                <Clock size={14} />
                <span>
                  {currentTime.toLocaleDateString(undefined, { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                  {' '}
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>

              <div className="live-indicator">
                <div className="live-dot"></div>
                <span>Live Feed</span>
              </div>

              <button 
                className="export-btn" 
                onClick={handleExportReport}
                disabled={alerts.length === 0}
                title="Download JSON threat summary"
              >
                <Download size={14} />
                Export Report
              </button>
            </div>
          </header>

          {/* Scrolling Threat Intelligence Ticker */}
          <div className="threat-ticker-container">
            <div className="threat-ticker-label">
              <div className="threat-ticker-label-dot" />
              <span>Sentinel Live Feed</span>
            </div>
            <div className="threat-ticker-viewport">
              <div className="threat-ticker-flow">
                <div className="threat-ticker-item">
                  📢 <strong>SYSTEM STABILITY:</strong> Active detection daemon: 12 nodes online. <strong>Model contamination:</strong> 5%.
                </div>
                <div className="threat-ticker-item">
                  🚨 <strong>AUDIT THREAT WATCH:</strong> Active Backlog: {alerts.filter(a => !a.status || !a.status.startsWith('resolved')).length} threats queued.
                </div>
                <div className="threat-ticker-item">
                  ⚡ <strong>NETWORK GATEWAY:</strong> 0.0.0.0 egress blocks active. Database connection pool: stable.
                </div>
                <div className="threat-ticker-item">
                  🔒 <strong>SECURITY UPDATE:</strong> HR travel registries parsed. Isolation Forest encoders matching.
                </div>
                {/* Duplicated for seamless loop scrolling marquee */}
                <div className="threat-ticker-item">
                  📢 <strong>SYSTEM STABILITY:</strong> Active detection daemon: 12 nodes online. <strong>Model contamination:</strong> 5%.
                </div>
                <div className="threat-ticker-item">
                  🚨 <strong>AUDIT THREAT WATCH:</strong> Active Backlog: {alerts.filter(a => !a.status || !a.status.startsWith('resolved')).length} threats queued.
                </div>
                <div className="threat-ticker-item">
                  ⚡ <strong>NETWORK GATEWAY:</strong> 0.0.0.0 egress blocks active. Database connection pool: stable.
                </div>
                <div className="threat-ticker-item">
                  🔒 <strong>SECURITY UPDATE:</strong> HR travel registries parsed. Isolation Forest encoders matching.
                </div>
              </div>
            </div>
          </div>

          {/* Global Server Connection Error Banner */}
          {error && (
            <div className="error-banner">
              <AlertCircle size={20} />
              <div className="error-banner-content">
                <h4>SOC Console Offline</h4>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Router Switch Views */}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={dashboardView} />
            <Route path="/resolved" element={resolvedView} />
            <Route path="/audit" element={
              <div className="dashboard-grid-v2">
                <div className="col-9">
                  <AuditLogPage alerts={alerts} onRefresh={fetchAlerts} />
                </div>
                <div className="col-3" style={{ display: 'flex', flexDirection: 'column' }}>
                  <SocAgentActivity />
                </div>
              </div>
            } />
            <Route path="/accuracy" element={
              <div className="dashboard-grid-v2">
                <div className="col-8">
                  <RuleAccuracyPanel jwt={jwt} />
                </div>
                <div className="col-4" style={{ display: 'flex', flexDirection: 'column' }}>
                  <RuleTuningAdvisor jwt={jwt} />
                </div>
              </div>
            } />
            <Route path="/heatmap" element={
              <div className="dashboard-grid-v2">
                <div className="col-12">
                  <DepartmentHeatmap alerts={alerts} />
                </div>
                <div className="col-12">
                  <CrossDeptThreatMatrix alerts={alerts} />
                </div>
              </div>
            } />
            <Route path="/admin" element={<AdminPanel jwt={jwt} />} />
          </Routes>
        </main>
      </div>

      {/* 5. User Forensic Modal (Drill-Down Investigation) */}
      <AnimatePresence>
        {selectedUserId && (
          <UserDetailModal 
            userId={selectedUserId} 
            onClose={() => setSelectedUserId(null)} 
            jwt={jwt}
          />
        )}
      </AnimatePresence>
    </Router>
  );
}
