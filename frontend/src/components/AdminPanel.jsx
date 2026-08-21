import React, { useState } from 'react';
import { Laptop, Shield, User, Calendar, MapPin, CheckCircle, AlertTriangle, Sliders, Activity, RefreshCw } from 'lucide-react';
import { fetchWithRetry } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

export default function AdminPanel({ jwt }) {
  // Device Trust Form State
  const [deviceUserId, setDeviceUserId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const [devMessage, setDevMessage] = useState(null);
  const [devError, setDevError] = useState(null);

  // Reset Demo Data States
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);
  const [resetError, setResetError] = useState(null);

  const handleResetData = async () => {
    if (!window.confirm("Are you sure you want to trigger a global system reset? This will clear all review notes/history and re-run baseline analytics calculations.")) {
      return;
    }
    
    setResetLoading(true);
    setResetMessage(null);
    setResetError(null);
    
    try {
      const response = await fetchWithRetry(`${API_BASE}/system/reset-demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || "Reset data call rejected by server.");
      }
      
      setResetMessage("Console telemetry reset successfully! Reloading ML pipeline and baselines established.");
    } catch (err) {
      console.error(err);
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // HR Status Form State
  const [hrUserId, setHrUserId] = useState('');
  const [empStatus, setEmpStatus] = useState('active');
  const [travelDeclared, setTravelDeclared] = useState(false);
  const [travelStart, setTravelStart] = useState('');
  const [travelEnd, setTravelEnd] = useState('');
  const [noticeStart, setNoticeStart] = useState('');
  const [hrLoading, setHrLoading] = useState(false);
  const [hrMessage, setHrMessage] = useState(null);
  const [hrError, setHrError] = useState(null);

  // Agent Registry Form State
  const [agentHostname, setAgentHostname] = useState('');
  const [agentUserId, setAgentUserId] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentMessage, setAgentMessage] = useState(null);
  const [agentError, setAgentError] = useState(null);

  // Handle Trusted Device Submission
  const handleRegisterDevice = async (e) => {
    e.preventDefault();
    if (!deviceUserId || !deviceId || !deviceName) {
      setDevError("All device registry fields are required.");
      return;
    }

    setDevLoading(true);
    setDevMessage(null);
    setDevError(null);

    try {
      const response = await fetch(`${API_BASE}/admin/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          user_id: deviceUserId,
          device_id: deviceId,
          device_name: deviceName
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || "Failed to register trusted device.");
      }

      setDevMessage(`Successfully registered trusted device ${deviceId} for ${deviceUserId}.`);
      setDeviceUserId('');
      setDeviceId('');
      setDeviceName('');
    } catch (err) {
      console.error(err);
      setDevError(err.message);
    } finally {
      setDevLoading(false);
    }
  };

  // Handle HR Status Submission
  const handleUpdateHR = async (e) => {
    e.preventDefault();
    if (!hrUserId) {
      setHrError("User ID is required for HR profiles.");
      return;
    }

    setHrLoading(true);
    setHrMessage(null);
    setHrError(null);

    const body = {
      user_id: hrUserId,
      employment_status: empStatus,
      travel_declared: travelDeclared,
      travel_start_date: travelDeclared ? (travelStart || null) : null,
      travel_end_date: travelDeclared ? (travelEnd || null) : null,
      notice_period_start_date: empStatus === 'notice_period' ? (noticeStart || null) : null
    };

    try {
      const response = await fetch(`${API_BASE}/admin/update-hr-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify(body)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || "Failed to update HR integration profile.");
      }

      setHrMessage(`Successfully updated HR status profile for ${hrUserId}.`);
      setHrUserId('');
      setEmpStatus('active');
      setTravelDeclared(false);
      setTravelStart('');
      setTravelEnd('');
      setNoticeStart('');
    } catch (err) {
      console.error(err);
      setHrError(err.message);
    } finally {
      setHrLoading(false);
    }
  };

  const handleRegisterAgent = async (e) => {
    e.preventDefault();
    if (!agentHostname || !agentUserId) {
      setAgentError("Hostname and User ID are required.");
      return;
    }

    setAgentLoading(true);
    setAgentMessage(null);
    setAgentError(null);

    try {
      const response = await fetchWithRetry(`${API_BASE}/admin/register-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          hostname: agentHostname,
          assigned_user_id: agentUserId
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || "Failed to register agent mapping.");
      }

      setAgentMessage(`Successfully registered agent ${agentHostname} for user ${agentUserId}.`);
      setAgentHostname('');
      setAgentUserId('');
    } catch (err) {
      console.error(err);
      setAgentError(err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <div className="admin-grid-v2">
      
      {/* Presentation Shortcuts Quick-Fill */}
      <div className="col-12" style={{ marginBottom: '16px' }}>
        <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="dashboard-card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '10px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} style={{ color: '#00D9FF' }} />
              Quick-Fill Presentation Shortcuts (Edge Cases)
            </h2>
          </div>
          <p style={{ fontSize: '11px', color: '#8B95A8', margin: 0 }}>
            Click any button below to instantly pre-fill administrative forms with parameters representing the key insider threat scenarios:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
            <button 
              type="button"
              className="export-btn"
              style={{ background: 'rgba(0, 217, 255, 0.08)', borderColor: '#00D9FF', color: '#00D9FF', padding: '6px 12px', fontSize: '11px' }}
              onClick={() => {
                setDeviceUserId('U021');
                setDeviceId('DEV_U021_PENDING');
                setDeviceName('IT Secure Workstation');
              }}
            >
              💻 Scenario 4: Auto-promote Device U021
            </button>
            <button 
              type="button"
              className="export-btn"
              style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: '#10B981', color: '#10B981', padding: '6px 12px', fontSize: '11px' }}
              onClick={() => {
                setHrUserId('U023');
                setEmpStatus('active');
                setTravelDeclared(true);
                setTravelStart('2026-08-10');
                setTravelEnd('2026-08-25');
              }}
            >
              ✈️ Scenario 5: Travel Exception U023
            </button>
            <button 
              type="button"
              className="export-btn"
              style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: '#F59E0B', color: '#F59E0B', padding: '6px 12px', fontSize: '11px' }}
              onClick={() => {
                setHrUserId('U024');
                setEmpStatus('notice_period');
                setTravelDeclared(false);
                setNoticeStart('2026-08-01');
              }}
            >
              📊 Multiplier: Notice Period U024
            </button>
            <button 
              type="button"
              className="export-btn"
              style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: '#EF4444', color: '#EF4444', padding: '6px 12px', fontSize: '11px' }}
              onClick={() => {
                setHrUserId('U025');
                setEmpStatus('on_leave');
                setTravelDeclared(false);
              }}
            >
              🌴 Scenario 5: On-Leave Violation U025
            </button>
          </div>
        </div>
      </div>

      {/* 1. Register Trusted Device Form */}
      <div className="col-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-card-header">
            <h2>
              <Laptop size={18} style={{ color: 'var(--color-info)' }} />
              Provision & Register Trusted Device
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: '#8B95A8', marginBottom: '20px' }}>
            Simulates provisioning a secure work laptop for an employee in the corporate registry.
          </p>

          <form onSubmit={handleRegisterDevice} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>User ID</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="e.g. U001" 
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  value={deviceUserId}
                  onChange={e => setDeviceUserId(e.target.value)}
                />
                <User size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Device Serial / ID</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="e.g. LAPTOP_ENG_419" 
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  value={deviceId}
                  onChange={e => setDeviceId(e.target.value)}
                />
                <Laptop size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Device Display Name</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="e.g. Alice's Work Macbook" 
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                />
                <Shield size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
              </div>
            </div>

            {devMessage && (
              <div style={{ padding: '8px 12px', background: 'var(--color-low-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-low)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={14} /> {devMessage}
              </div>
            )}

            {devError && (
              <div style={{ padding: '8px 12px', background: 'var(--color-high-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-high)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} /> {devError}
              </div>
            )}

            <div style={{ flexGrow: 1 }} />

            <button 
              type="submit" 
              className="export-btn" 
              style={{ width: '100%', justifyContent: 'center', padding: '10px', background: 'var(--color-info)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
              disabled={devLoading}
            >
              {devLoading ? 'Registering Device...' : 'Register Trusted Device'}
            </button>
          </form>
        </div>
      </div>

      {/* 2. Update HR Integration Profile Form */}
      <div className="col-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-card-header">
            <h2>
              <User size={18} style={{ color: 'var(--color-med)' }} />
              Update HR Integration Profile Context
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: '#8B95A8', marginBottom: '20px' }}>
            Simulates updates to payroll, leave records, travel declarations, and employee notices.
          </p>

          <form onSubmit={handleUpdateHR} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>User ID</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="e.g. U001" 
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  value={hrUserId}
                  onChange={e => setHrUserId(e.target.value)}
                />
                <User size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Employment Status</label>
                <select 
                  className="filter-select"
                  style={{ width: '100%', padding: '8px', height: '36px' }}
                  value={empStatus}
                  onChange={e => setEmpStatus(e.target.value)}
                >
                  <option value="active">Active Duty</option>
                  <option value="on_leave">On Approved Leave</option>
                  <option value="notice_period">In Notice Period</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fff', cursor: 'pointer', marginTop: '16px' }}>
                  <input 
                    type="checkbox" 
                    checked={travelDeclared}
                    onChange={e => setTravelDeclared(e.target.checked)}
                  />
                  Travel Declared
                </label>
              </div>
            </div>

            {empStatus === 'notice_period' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Notice Period Start Date</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="date" 
                    className="search-input"
                    style={{ width: '100%', paddingLeft: '32px' }}
                    value={noticeStart}
                    onChange={e => setNoticeStart(e.target.value)}
                  />
                  <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
                </div>
              </div>
            )}

            {travelDeclared && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Travel Start Date</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="date" 
                      className="search-input"
                      style={{ width: '100%', paddingLeft: '32px' }}
                      value={travelStart}
                      onChange={e => setTravelStart(e.target.value)}
                    />
                    <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Travel End Date</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="date" 
                      className="search-input"
                      style={{ width: '100%', paddingLeft: '32px' }}
                      value={travelEnd}
                      onChange={e => setTravelEnd(e.target.value)}
                    />
                    <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
                  </div>
                </div>
              </div>
            )}

            {hrMessage && (
              <div style={{ padding: '8px 12px', background: 'var(--color-low-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-low)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={14} /> {hrMessage}
              </div>
            )}

            {hrError && (
              <div style={{ padding: '8px 12px', background: 'var(--color-high-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-high)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} /> {hrError}
              </div>
            )}

            <div style={{ flexGrow: 1 }} />

            <button 
              type="submit" 
              className="export-btn" 
              style={{ width: '100%', justifyContent: 'center', padding: '10px', background: 'var(--color-med)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
              disabled={hrLoading}
            >
              {hrLoading ? 'Updating Profile...' : 'Update HR Profile Context'}
            </button>
          </form>
        </div>
      </div>

      {/* 3. Sentinel Classifier Weights & Thresholds */}
      <div className="col-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-card-header">
            <h2>
              <Sliders size={18} style={{ color: 'var(--color-info)' }} />
              Sentinel Engine Hyperparameters
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: '#8B95A8', marginBottom: '20px' }}>
            Configure detection engine heuristics thresholds and Isolation Forest model parameters.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>
                <span>Anomaly Threshold Score</span>
                <span style={{ color: '#fff' }}>60.0</span>
              </div>
              <input type="range" min="30" max="90" defaultValue="60" style={{ accentColor: '#6366F1', cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>
                <span>Isolation Forest Contamination Rate</span>
                <span style={{ color: '#fff' }}>0.05 (5%)</span>
              </div>
              <input type="range" min="1" max="15" defaultValue="5" style={{ accentColor: '#6366F1', cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Active Feature Coefficients</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                <span className="reason-pill" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.15)', fontSize: '10px' }}>download_mb (x1.5)</span>
                <span className="reason-pill" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.15)', fontSize: '10px' }}>login_hour (x1.0)</span>
                <span className="reason-pill" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.15)', fontSize: '10px' }}>location_encoded (x2.0)</span>
                <span className="reason-pill" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.15)', fontSize: '10px' }}>device_encoded (x1.8)</span>
                <span className="reason-pill" style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.15)', fontSize: '10px' }}>dept_mismatch (x2.5)</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Active Classifier Nodes</label>
              <div style={{ fontSize: '12px', color: '#E8EDF5', background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Isolation Forest Estimators</span>
                  <span style={{ color: '#10B981', fontWeight: 'bold' }}>100 Trees</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>DB Scan Distance (eps)</span>
                  <span style={{ color: '#10B981', fontWeight: 'bold' }}>0.50</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Heuristics Rule Filters</span>
                  <span style={{ color: '#10B981', fontWeight: 'bold' }}>8 Rules Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Real-Time Daemon Diagnostics */}
      <div className="col-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-card-header">
            <h2>
              <Activity size={18} style={{ color: '#10B981' }} />
              Sentinel Engine Live Diagnostics
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: '#8B95A8', marginBottom: '16px' }}>
            Local machine resources, database pool state, and detection engine logs.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
            {/* System Resources Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#0a0d16', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase' }}>CPU Engine Load</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ flexGrow: 1, height: '4px', background: '#2D3748', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: '12%', height: '100%', background: '#10B981' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10B981' }}>12%</span>
                </div>
              </div>

              <div style={{ background: '#0a0d16', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase' }}>Memory Allocated</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ flexGrow: 1, height: '4px', background: '#2D3748', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: '24%', height: '100%', background: '#3B82F6' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#3B82F6' }}>244MB</span>
                </div>
              </div>
            </div>

            {/* Diagnostic Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Process Status & Sign-ins</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0B1120', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: '#64748B' }}>State</span>
                  <span style={{ color: '#10B981', fontWeight: 'bold' }}>RUNNING</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0B1120', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: '#64748B' }}>Telemetry Pool</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>10 / 10</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0B1120', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: '#64748B' }}>Connected Sensors</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>12 online</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0B1120', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: '#64748B' }}>Detections/Sec</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>1,024 req/s</span>
                </div>
              </div>
            </div>

            {/* Live diagnostics log ticker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>System Journal Logs</label>
              <div style={{ 
                fontFamily: 'monospace', 
                fontSize: '10px', 
                color: '#818CF8', 
                background: '#060814', 
                border: '1px solid rgba(255,255,255,0.03)', 
                borderRadius: '6px', 
                padding: '8px 12px', 
                height: '75px', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ opacity: 0.6 }}>[21:42:01] Sentinels active, listening on port 8000</div>
                <div style={{ opacity: 0.8 }}>[21:42:10] Sync: Recalculated 30 user baselines successfully.</div>
                <div style={{ color: '#34D399' }}>[21:42:15] ML: Scored 8,779 activity rows. 0 outliers.</div>
                <div style={{ color: '#FBBF24', animation: 'pulse 1.5s infinite' }}>[21:42:17] System policy diagnostics running optimal.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Add New Agent Mapping */}
      <div className="col-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-card-header">
            <h2>
              <Laptop size={18} style={{ color: 'var(--color-info)' }} />
              Add New Agent Registry Mapping
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: '#8B95A8', marginBottom: '20px' }}>
            Maps a remote hostname to an employee User ID so incoming telemetry maps to their profile.
          </p>

          <form onSubmit={handleRegisterAgent} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>PC Hostname</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="e.g. WORKSTATION-01" 
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  value={agentHostname}
                  onChange={e => setAgentHostname(e.target.value)}
                />
                <Laptop size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8' }}>Assign to Employee User ID</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="e.g. U001" 
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  value={agentUserId}
                  onChange={e => setAgentUserId(e.target.value)}
                />
                <User size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#8B95A8' }} />
              </div>
            </div>

            {agentMessage && (
              <div style={{ padding: '8px 12px', background: 'var(--color-low-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-low)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={14} /> {agentMessage}
              </div>
            )}

            {agentError && (
              <div style={{ padding: '8px 12px', background: 'var(--color-high-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-high)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} /> {agentError}
              </div>
            )}

            <div style={{ flexGrow: 1 }} />

            <button 
              type="submit" 
              className="export-btn" 
              style={{ width: '100%', justifyContent: 'center', padding: '10px', background: 'var(--color-info)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
              disabled={agentLoading}
            >
              {agentLoading ? 'Mapping Agent...' : 'Map Agent Hostname'}
            </button>
          </form>
        </div>
      </div>

      {/* 6. Danger Zone / Reset Demo Data (Full Width) */}
      <div className="col-12" style={{ marginTop: '12px' }}>
        <div className="dashboard-card" style={{ border: '1px solid rgba(239, 68, 68, 0.15)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <div className="dashboard-card-header">
            <h2 style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              Danger Zone - System Demo Reset Control
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: '#8B95A8', marginBottom: '16px', lineHeight: '1.5' }}>
            Clears all historical alerts/risk events review status, resets HR employee files to defaults, wipes shift change and unrecognized devices registry logs, and re-calculates all ML isolation forest baseline profiles. Useful for resetting system telemetry to default clean state between active client presentation runs.
          </p>
          
          {resetMessage && (
            <div style={{ padding: '10px 14px', background: 'var(--color-low-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-low)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CheckCircle size={14} /> {resetMessage}
            </div>
          )}

          {resetError && (
            <div style={{ padding: '10px 14px', background: 'var(--color-high-bg)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-high)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertTriangle size={14} /> {resetError}
            </div>
          )}

          <button 
            type="button"
            onClick={handleResetData}
            disabled={resetLoading}
            style={{
              background: '#EF4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {resetLoading ? (
              <>
                <RefreshCw size={14} className="spin-slow" />
                Resetting Telemetry Database & Recalculating Baselines...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Trigger Global System Demo Reset
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
