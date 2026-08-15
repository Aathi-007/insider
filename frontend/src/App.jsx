import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Download, Clock, AlertCircle, BarChart2, ListTodo, Users2, LayoutDashboard, Settings, ShieldCheck, Network, LogOut } from 'lucide-react';
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
import NetworkGraphPanel from './components/NetworkGraphPanel';

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

function LoginView({ setJwt }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all credentials fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed. Invalid username or password.");
      }
      localStorage.setItem('ueba_jwt', data.access_token);
      setJwt(data.access_token);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    })
      .then(res => {
        if (!res.ok) throw new Error("Demo login failed.");
        return res.json();
      })
      .then(data => {
        localStorage.setItem('ueba_jwt', data.access_token);
        setJwt(data.access_token);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #1E293B 0%, #0F172A 100%)',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        
        {/* Logo and title */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            color: '#EF4444',
            width: 'fit-content'
          }}>
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: 0 }}>
            UEBA Insider Threat Console
          </h2>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SOC Operations Terminal Gate
          </span>
        </div>

        {/* Error notification */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '6px',
            color: '#F87171',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Username</label>
            <input 
              type="text" 
              placeholder="Enter your console username..." 
              className="search-input"
              style={{ width: '100%', padding: '10px' }}
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Password</label>
            <input 
              type="password" 
              placeholder="Enter your console password..." 
              className="search-input"
              style={{ width: '100%', padding: '10px' }}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="export-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              background: '#6366F1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '8px',
              transition: 'all 0.2s'
            }}
            disabled={loading}
          >
            {loading ? 'Authenticating Terminal...' : 'Access Console Terminal'}
          </button>
        </form>

        {/* Quick Demo Logins Section */}
        <div style={{
          marginTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }}>
            Quick Demo Presets Logins
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => handleDemoLogin('analyst', 'analyst123')}
              className="export-btn"
              style={{ padding: '8px', justifyContent: 'center', fontSize: '11px' }}
              disabled={loading}
            >
              🔐 Log in as Analyst
            </button>
            <button
              onClick={() => handleDemoLogin('admin', 'admin123')}
              className="export-btn"
              style={{ padding: '8px', justifyContent: 'center', fontSize: '11px', borderColor: 'rgba(99,102,241,0.2)', color: '#818CF8' }}
              disabled={loading}
            >
              🛡️ Log in as Admin
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [jwt, setJwt] = useState(localStorage.getItem('ueba_jwt') || '');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  
  // State for live clock in header
  const [currentTime, setCurrentTime] = useState(new Date());

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
      const response = await fetch(`${API_BASE}/alerts?page=1&limit=1000`, {
        headers: { 
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (response.status === 401) {
        setJwt('');
        localStorage.removeItem('ueba_jwt');
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

  useEffect(() => {
    if (jwt) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 4000);
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
      <Router>
        <style>{styleContent}</style>
        <LoginView setJwt={setJwt} />
      </Router>
    );
  }

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
            
            <NavLink to="/network" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Network size={16} />
              <span>Network Graph</span>
            </NavLink>

            {currentUser && currentUser.role === 'admin' && (
              <NavLink to="/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <Settings size={16} />
                <span>Admin Panel</span>
              </NavLink>
            )}
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

              {currentUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '11px' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{currentUser.sub}</span>
                    <span style={{ color: '#8B95A8', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>{currentUser.role}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setJwt('');
                      localStorage.removeItem('ueba_jwt');
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '4px',
                      color: '#F87171',
                      padding: '5px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                    title="Log out from console"
                  >
                    <LogOut size={12} />
                    Logout
                  </button>
                </div>
              )}

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
            <Route path="/admin" element={
              currentUser && currentUser.role === 'admin' ? (
                <AdminPanel jwt={jwt} />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            } />
            <Route path="/network" element={<NetworkGraphPanel jwt={jwt} />} />
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
