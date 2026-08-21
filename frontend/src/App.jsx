import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Download, Clock, AlertCircle, BarChart2, ListTodo, Users2, LayoutDashboard, Settings, ShieldCheck, Network, LogOut, ChevronLeft, ChevronRight, Laptop } from 'lucide-react';
import { HashRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';

import LoginPage from './components/LoginPage';
import { fetchWithRetry } from './utils/api';
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
import NetworkGraphPanel from './components/NetworkGraphPanel';
import ConnectedAgents from './components/ConnectedAgents';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

const styleContent = `
  .app-layout {
    display: flex;
    min-height: 100vh;
    background: #060B14;
  }
  .sidebar {
    width: 240px;
    background: #0D1526;
    border-right: 1px solid #1C2942;
    padding: 20px 14px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    flex-shrink: 0;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }
  .sidebar.collapsed {
    width: 72px;
    padding: 20px 10px;
  }
  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
    padding: 0 8px;
    overflow: hidden;
    white-space: nowrap;
  }
  .sidebar-menu {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .sidebar-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sidebar-group-title {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 800;
    color: #475569;
    letter-spacing: 1px;
    padding: 0 8px;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
    border-left: 3px solid transparent;
  }
  .sidebar-link:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.02);
  }
  .sidebar-link.active {
    color: #00D9FF;
    background: rgba(0, 217, 255, 0.05);
    border-left: 3px solid #00D9FF;
    border-radius: 0 6px 6px 0;
    padding-left: 9px;
  }
  .sidebar-toggle-btn {
    background: transparent;
    border: 1px solid #1C2942;
    color: #8B95A8;
    border-radius: 4px;
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    outline: none;
  }
  .sidebar-toggle-btn:hover {
    color: #00D9FF;
    border-color: #00D9FF;
  }
  .sidebar-user-section {
    margin-top: auto;
    border-top: 1px solid #1C2942;
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }
  .user-avatar-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 217, 255, 0.1);
    border: 1.5px solid #00D9FF;
    color: #00D9FF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  }
  .main-content {
    flex-grow: 1;
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-sizing: border-box;
    position: relative;
    z-index: 1;
  }
`;

// LoginPage is imported externally.

function AppInner() {
  const [jwt, setJwt] = useState(sessionStorage.getItem('ueba_jwt') || localStorage.getItem('ueba_jwt') || '');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [systemStatus, setSystemStatus] = useState({
    total_users: 0,
    active_alerts: 0,
    last_recalculation: 'Never'
  });
  
  // State for live clock in header
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const getLoggedInUser = () => {
    if (!jwt) return null;
    try {
      const base64Url = jwt.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };
  
  const currentUser = getLoggedInUser();

  // Polling Alerts Data in App.jsx to synchronize all charts and grids
  const fetchAlerts = async () => {
    if (!jwt) return;
    try {
      const response = await fetchWithRetry(`${API_BASE}/alerts?page=1&limit=1000`, {
        headers: { 
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (response.status === 401) {
        setJwt('');
        localStorage.removeItem('ueba_jwt');
        sessionStorage.removeItem('ueba_jwt');
        throw new Error("Session expired. Please log in again.");
      }
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const data = await response.json();
      setAlerts(data.alerts || data);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error polling alerts in App:", err);
      setError(err.message || "Cannot connect to server - is the backend running?");
      setLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    if (!jwt) return;
    try {
      const response = await fetchWithRetry(`${API_BASE}/system/status`, {
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (err) {
      console.error("Error fetching system status:", err);
    }
  };

  useEffect(() => {
    if (jwt) {
      fetchAlerts();
      fetchSystemStatus();
      const interval = setInterval(() => {
        fetchAlerts();
        fetchSystemStatus();
      }, 4000);
      return () => {
        clearInterval(interval);
      };
    }
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
      {/* Telemetry Status Bar */}
      <div className="col-12" style={{
        background: '#0D1526',
        border: '1px solid #1C2942',
        borderRadius: '8px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        fontSize: '12px',
        color: '#8B95A8',
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: '0 0 10px rgba(0, 217, 255, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D9FF', boxShadow: '0 0 8px #00D9FF' }} />
          <span>System Status: <strong style={{ color: '#00D9FF' }}>OPERATIONAL</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '32px' }}>
          <span>Monitored Users: <strong style={{ color: '#E8EDF5' }}>{systemStatus.total_users}</strong></span>
          <span>Active Alerts: <strong style={{ color: '#FF3B5C' }}>{systemStatus.active_alerts}</strong></span>
          <span>Last Recalculation: <strong style={{ color: '#E8EDF5' }}>
            {systemStatus.last_recalculation && systemStatus.last_recalculation !== 'Never'
              ? new Date(systemStatus.last_recalculation).toLocaleString()
              : 'Never'}
          </strong></span>
        </div>
      </div>

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

  if (!jwt) {
    return (
      <>
        <style>{styleContent}</style>
        <LoginPage setJwt={setJwt} />
      </>
    );
  }

  const location = useLocation();

  const getHeaderDetails = () => {
    const path = location.pathname;
    switch (path) {
      case '/dashboard':
        return {
          title: 'Threat Detection Center',
          desc: 'Real-time telemetry watch and risk score anomaly monitoring queue.',
          action: (
            <button className="export-btn" onClick={handleExportReport} disabled={alerts.length === 0}>
              <Download size={14} /> Export Report
            </button>
          )
        };
      case '/resolved':
        return {
          title: 'Mitigated Registry',
          desc: 'Historical ledger of resolved alerts, confirmed threats, and false positives.',
          action: (
            <button className="export-btn" onClick={handleExportReport} disabled={resolvedAlerts.length === 0}>
              <Download size={14} /> Export Resolved
            </button>
          )
        };
      case '/audit':
        return {
          title: 'SOC Auditor Trails',
          desc: 'Administrative records tracking analyst investigations and system status revisions.',
          action: null
        };
      case '/accuracy':
        return {
          title: 'Rule Performance Metrics',
          desc: 'Precision analytics, trigger rates, and True Positive statistics for threat rules.',
          action: null
        };
      case '/heatmap':
        return {
          title: 'Divergence Heatmaps',
          desc: 'Department risk comparison matrix and department behavioral divergence models.',
          action: null
        };
      case '/network':
        return {
          title: 'Backbone Server Topology',
          desc: 'Dynamic circular graph visualising departmental server communications and baseline paths.',
          action: null
        };
      case '/agents':
        return {
          title: 'Connected PC Agents',
          desc: 'Live telemetry watch and event registry of intranet endpoint collectors.',
          action: null
        };
      case '/admin':
        return {
          title: 'Administrative Controls',
          desc: 'HR travel registry overrides, device trust provisionings, and demo data resets.',
          action: null
        };
      default:
        return {
          title: 'Insider Threat Console',
          desc: 'Real-time Entity Behavior Analytics & SOC Command.',
          action: null
        };
    }
  };

  const headerDetails = getHeaderDetails();

  return (
    <div className="app-layout">
      <style>{styleContent}</style>
      
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <ShieldAlert size={22} style={{ color: '#00D9FF' }} />
            {!sidebarCollapsed && <span style={{ fontWeight: '800', letterSpacing: '0.5px' }}>SOC COMMAND</span>}
          </div>
          {!sidebarCollapsed && (
            <button 
              type="button" 
              className="sidebar-toggle-btn" 
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
        
        {sidebarCollapsed && (
          <button 
            type="button" 
            className="sidebar-toggle-btn" 
            style={{ alignSelf: 'center', marginBottom: '8px' }}
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
        )}

        <nav className="sidebar-menu" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Group 1: Monitoring */}
          <div className="sidebar-group">
            {!sidebarCollapsed && <div className="sidebar-group-title">Monitoring</div>}
            <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="All Threats Dashboard">
              <LayoutDashboard size={16} />
              {!sidebarCollapsed && <span>All Alerts</span>}
            </NavLink>
            <NavLink to="/resolved" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Closed Registry">
              <ShieldCheck size={16} />
              {!sidebarCollapsed && <span>Resolved Alerts</span>}
            </NavLink>
            <NavLink to="/agents" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="PC Telemetry Agents">
              <Laptop size={16} />
              {!sidebarCollapsed && <span>PC Agents</span>}
            </NavLink>
          </div>

          {/* Group 2: Analytics */}
          <div className="sidebar-group">
            {!sidebarCollapsed && <div className="sidebar-group-title">Analytics</div>}
            <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Auditor Logs">
              <ListTodo size={16} />
              {!sidebarCollapsed && <span>Audit Log</span>}
            </NavLink>
            <NavLink to="/accuracy" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Detection Model Stats">
              <BarChart2 size={16} />
              {!sidebarCollapsed && <span>Rule Accuracy</span>}
            </NavLink>
            <NavLink to="/heatmap" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Risk Heatmap">
              <Users2 size={16} />
              {!sidebarCollapsed && <span>Dept Heatmap</span>}
            </NavLink>
            <NavLink to="/network" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Path Telemetry">
              <Network size={16} />
              {!sidebarCollapsed && <span>Network Graph</span>}
            </NavLink>
          </div>

          {/* Group 3: Administration */}
          {currentUser && currentUser.role === 'admin' && (
            <div className="sidebar-group">
              {!sidebarCollapsed && <div className="sidebar-group-title">Administration</div>}
              <NavLink to="/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Admin Panel">
                <Settings size={16} />
                {!sidebarCollapsed && <span>Admin Panel</span>}
              </NavLink>
            </div>
          )}
          
          {/* User Session Block */}
          {currentUser && (
            <div className="sidebar-user-section" style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
                <div className="user-avatar-circle" title={`${currentUser.sub} (${currentUser.role})`}>
                  {currentUser.sub.slice(0, 2).toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ color: '#E8EDF5', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentUser.sub}
                    </span>
                    <span style={{ color: '#8B95A8', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>
                      {currentUser.role}
                    </span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => {
                  setJwt('');
                  localStorage.removeItem('ueba_jwt');
                  sessionStorage.removeItem('ueba_jwt');
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1.5px solid #FF3B5C',
                  color: '#FF3B5C',
                  borderRadius: '4px',
                  padding: sidebarCollapsed ? '6px' : '8px 12px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  transition: 'all 0.2s',
                  fontFamily: "'JetBrains Mono', monospace"
                }}
                title="Log out from console"
              >
                <LogOut size={12} />
                {!sidebarCollapsed && <span>LOGOUT</span>}
              </button>
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="dashboard-header" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'rgba(13, 21, 38, 0.4)', border: '1px solid #1C2942', padding: '16px 24px', borderRadius: '8px' }}>
          <div className="header-titles">
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} style={{ color: '#00D9FF' }} />
              {headerDetails.title}
            </h1>
            <p style={{ fontSize: '11px', color: '#8B95A8', margin: '4px 0 0 0' }}>{headerDetails.desc}</p>
          </div>
          
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="live-clock">
              <Clock size={12} />
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
              <span>Feed Live</span>
            </div>

            {headerDetails.action}
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
          <Route path="/admin" element={
            currentUser && currentUser.role === 'admin' ? (
              <AdminPanel jwt={jwt} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          } />
          <Route path="/network" element={<NetworkGraphPanel jwt={jwt} />} />
          <Route path="/agents" element={<ConnectedAgents jwt={jwt} />} />
        </Routes>
      </main>
      
      {/* User Forensic Modal (Drill-Down Investigation) */}
      <AnimatePresence>
        {selectedUserId && (
          <UserDetailModal 
            userId={selectedUserId} 
            onClose={() => setSelectedUserId(null)} 
            jwt={jwt}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}
