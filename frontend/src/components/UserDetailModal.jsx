import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ReferenceLine, Label,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { 
  X, Shield, Activity, BarChart2, Layers, 
  Download, Clock, Laptop, Globe, AlertTriangle, User 
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

export default function UserDetailModal({ userId, onClose, jwt }) {
  const [data, setData] = useState(null);
  const [hrStatus, setHrStatus] = useState(null);
  const [devicesList, setDevicesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Notes and resolutions state per risk event ID
  const [noteInputs, setNoteInputs] = useState({});
  const [resNotes, setResNotes] = useState({});
  const [submittingNote, setSubmittingNote] = useState({});
  const [submittingResolve, setSubmittingResolve] = useState({});

  const fetchUserData = async () => {
    try {
      // 1. Fetch Core User Forensics
      const response = await fetch(`${API_BASE}/user/${userId}`, {
        headers: { 
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const jsonData = await response.json();
      setData(jsonData);

      // 2. Fetch HR Status Context
      const hrRes = await fetch(`${API_BASE}/admin/hr-status/${userId}`, {
        headers: { 
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (hrRes.ok) {
        const hrData = await hrRes.json();
        setHrStatus(hrData);
      }

      // 3. Fetch Device Trust Status List
      const devRes = await fetch(`${API_BASE}/admin/devices/${userId}`, {
        headers: { 
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevicesList(devData || []);
      }

      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching user detail:", err);
      setError("Failed to load user profile");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId || !jwt) return;
    setLoading(true);
    fetchUserData();
  }, [userId, jwt]);

  if (!userId) return null;

  // Helper to format reasons
  const formatReason = (reason) => {
    if (!reason) return '';
    return reason
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper: compute radar chart values based on real risk history reason contribution
  const getRadarData = (riskHistory) => {
    const categories = {
      'Download Vol': 0,
      'Location': 0,
      'Login Hour': 0,
      'Device': 0,
      'Dept Access': 0
    };

    if (!riskHistory || riskHistory.length === 0) {
      return Object.keys(categories).map(subject => ({ subject, score: 20 }));
    }

    riskHistory.forEach(event => {
      const score = event.risk_score || 60;
      const reasons = event.reasons || [];
      
      reasons.forEach(reason => {
        if (!reason) return;
        const r = reason.toLowerCase();
        if (r.includes('download')) {
          categories['Download Vol'] = Math.max(categories['Download Vol'], score);
        }
        if (r.includes('location')) {
          categories['Location'] = Math.max(categories['Location'], score);
        }
        if (r.includes('hour') || r.includes('time')) {
          categories['Login Hour'] = Math.max(categories['Login Hour'], score);
        }
        if (r.includes('device')) {
          categories['Device'] = Math.max(categories['Device'], score);
        }
        if (r.includes('department') || r.includes('mismatch')) {
          categories['Dept Access'] = Math.max(categories['Dept Access'], score);
        }
      });
    });

    return Object.keys(categories).map(subject => ({
      subject,
      score: categories[subject] === 0 ? 15 : categories[subject]
    }));
  };

  // API Action Handlers
  const handleAssign = async (alertId) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ analyst_name: 'Analyst_1' })
      });
      if (response.ok) fetchUserData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async (alertId) => {
    const noteText = noteInputs[alertId] || '';
    if (!noteText.trim()) return;

    setSubmittingNote(prev => ({ ...prev, [alertId]: true }));
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/add-note`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ note: noteText })
      });
      if (response.ok) {
        setNoteInputs(prev => ({ ...prev, [alertId]: '' }));
        await fetchUserData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingNote(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleResolve = async (alertId, status) => {
    const noteText = resNotes[alertId] || '';
    if (!noteText.trim()) {
      alert("Resolution note is required to close this alert.");
      return;
    }

    setSubmittingResolve(prev => ({ ...prev, [alertId]: true }));
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          resolution: status,
          note: noteText
        })
      });
      if (response.ok) {
        setResNotes(prev => ({ ...prev, [alertId]: '' }));
        await fetchUserData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingResolve(prev => ({ ...prev, [alertId]: false }));
    }
  };

  const handleEscalate = async (alertId) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/escalate`, {
        method: 'PATCH',
        headers: {
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (response.ok) fetchUserData();
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to parse notes history line by line
  const parseNotesThread = (notesText) => {
    if (!notesText) return [];
    return notesText.split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const match = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (match) {
          return { timestamp: match[1], text: match[2] };
        }
        return { timestamp: null, text: trimmed };
      })
      .filter(n => n !== null);
  };

  // Helper to lookup device used in a specific event
  const getEventDevice = (eventId) => {
    const act = data?.activity_history?.find(a => a.event_id === eventId);
    return act ? act.device_id : 'Unknown';
  };

  const getDeviceTrustStatus = (deviceId) => {
    const dev = devicesList.find(d => d.device_id === deviceId);
    return dev ? dev.status : 'unrecognized';
  };

  // Format activity history for the Area Chart
  const chartData = data?.activity_history 
    ? [...data.activity_history].reverse().map(act => ({
        ...act,
        shortTime: new Date(act.timestamp).toLocaleTimeString(undefined, { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        download: act.download_mb
      }))
    : [];

  const baseline = data?.baseline;
  const riskHistory = data?.risk_history || [];

  const maxRiskScore = riskHistory.length > 0 
    ? Math.max(...riskHistory.map(h => h.risk_score)) 
    : 0;

  const isCritical = maxRiskScore > 80;
  const isHigh = maxRiskScore >= 60 && maxRiskScore <= 80;
  const threatLabel = isCritical ? 'CRITICAL THREAT' : isHigh ? 'HIGH RISK PROFILE' : 'MONITORED';
  const badgeColor = isCritical ? 'var(--color-high)' : isHigh ? 'var(--color-med)' : 'var(--color-low)';
  const badgeBg = isCritical ? 'var(--color-high-bg)' : isHigh ? 'var(--color-med-bg)' : 'var(--color-low-bg)';

  const renderRiskCircle = (score) => {
    const isHigh = score > 80;
    const isMed = score >= 60 && score <= 80;
    const color = isHigh ? '#EF4444' : isMed ? '#F59E0B' : '#10B981';
    const radius = 14;
    const strokeWidth = 2.5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    return (
      <div style={{ position: 'relative', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="34" height="34" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="17"
            cy="17"
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="17"
            cy="17"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <span style={{ position: 'absolute', fontSize: '9px', fontWeight: 'bold', color: '#fff' }}>
          {score}
        </span>
      </div>
    );
  };

  const renderStatusBadge = (statusStr) => {
    const s = statusStr ? statusStr.toLowerCase() : 'new';
    
    let label = 'New';
    let dotColor = '#3B82F6';
    let bgColor = 'rgba(59, 130, 246, 0.08)';
    let borderColor = 'rgba(59, 130, 246, 0.15)';
    
    if (s === 'under_review') {
      label = 'Under Review';
      dotColor = '#F59E0B';
      bgColor = 'rgba(245, 158, 11, 0.08)';
      borderColor = 'rgba(245, 158, 11, 0.15)';
    } else if (s === 'escalated') {
      label = 'Escalated';
      dotColor = '#A855F7';
      bgColor = 'rgba(168, 85, 247, 0.08)';
      borderColor = 'rgba(168, 85, 247, 0.15)';
    } else if (s === 'resolved_false_positive') {
      label = 'Resolved - FP';
      dotColor = '#8B95A8';
      bgColor = 'rgba(139, 149, 168, 0.08)';
      borderColor = 'rgba(139, 149, 168, 0.15)';
    } else if (s === 'resolved_confirmed_threat') {
      label = 'Resolved - Threat';
      dotColor = '#EF4444';
      bgColor = 'rgba(239, 68, 68, 0.08)';
      borderColor = 'rgba(239, 68, 68, 0.15)';
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
        {label}
      </span>
    );
  };

  const renderDeviceBadge = (status) => {
    let label = 'Unrecognized';
    let dotColor = '#EF4444';
    let bgColor = 'rgba(239, 68, 68, 0.08)';
    let borderColor = 'rgba(239, 68, 68, 0.15)';
    
    if (status === 'trusted') {
      label = 'Trusted';
      dotColor = '#10B981';
      bgColor = 'rgba(16, 185, 129, 0.08)';
      borderColor = 'rgba(16, 185, 129, 0.15)';
    } else if (status === 'pending') {
      label = 'Pending';
      dotColor = '#F59E0B';
      bgColor = 'rgba(245, 158, 11, 0.08)';
      borderColor = 'rgba(245, 158, 11, 0.15)';
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
        {label}
      </span>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="modal-container" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1000px', width: '95%' }}
      >
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <Shield size={24} style={{ color: badgeColor }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>Forensic Investigation</h3>
                <span 
                  style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    color: badgeColor,
                    background: badgeBg,
                    border: `1px solid ${badgeColor}30`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.5px'
                  }}
                >
                  {threatLabel}
                </span>
              </div>
              <p className="modal-header-subtitle">
                Correlated metadata analysis for User: <strong>{data?.activity_history?.[0]?.user_name || userId}</strong> (ID: {userId})
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div style={{ height: '450px' }} className="loading-container">
            <div className="spinner"></div>
            <p>Constructing forensics timelines...</p>
          </div>
        ) : error ? (
          <div style={{ height: '200px', padding: '40px' }} className="no-data">
            <p style={{ color: 'var(--color-high)' }}>{error}</p>
            <button type="button" onClick={onClose} className="pagination-btn" style={{ margin: '16px auto 0 auto' }}>
              Dismiss Profile
            </button>
          </div>
        ) : (
          <div className="modal-body" style={{ maxHeight: '75vh' }}>
            
            {/* Top Grid: Baseline Metrics, HR Context & Radar Chart */}
            <div className="modal-grid-top">
              
              {/* Left Side: Radar Chart and HR Context Profile */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="radar-section">
                  <h4>
                    <AlertTriangle size={14} style={{ color: 'var(--color-high)' }} />
                    Behavioral Anomalies Vector
                  </h4>
                  <div className="radar-chart-container" style={{ height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarData(riskHistory)}>
                        <PolarGrid stroke="rgba(255, 255, 255, 0.05)" />
                        <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={9} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255, 255, 255, 0.1)" fontSize={7} />
                        <Radar name="Anomaly Severity" dataKey="score" stroke={badgeColor} fill={badgeColor} fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* HR Profile Context Card */}
                <div style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', margin: '0 0 12px 0' }}>
                    <User size={14} style={{ color: 'var(--color-med)' }} />
                    HR Integration Profile Context
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                      <span style={{ color: '#64748b' }}>Employment Status</span>
                      <span style={{ 
                        fontWeight: 'bold', 
                        color: hrStatus?.employment_status === 'notice_period' ? 'var(--color-high)' : hrStatus?.employment_status === 'on_leave' ? 'var(--color-med)' : 'var(--color-low)'
                      }}>
                        {hrStatus?.employment_status ? hrStatus.employment_status.toUpperCase().replace('_', ' ') : 'ACTIVE'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                      <span style={{ color: '#64748b' }}>Travel Declared</span>
                      <span style={{ fontWeight: 'bold', color: hrStatus?.travel_declared ? 'var(--color-info)' : '#475569' }}>
                        {hrStatus?.travel_declared ? 'YES' : 'NO'}
                      </span>
                    </div>

                    {hrStatus?.travel_declared && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', background: '#070a12', padding: '6px 10px', borderRadius: '4px' }}>
                        <span style={{ color: '#64748b' }}>Travel Dates</span>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{hrStatus.travel_start_date} to {hrStatus.travel_end_date}</span>
                      </div>
                    )}

                    {hrStatus?.employment_status === 'notice_period' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', background: 'rgba(244,63,94,0.04)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.1)' }}>
                        <span style={{ color: 'var(--color-high)' }}>Notice Period Started</span>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{hrStatus.notice_period_start_date}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side: Operational Baseline List & User Devices Trust Registry */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="baseline-section">
                  <h4>
                    <Layers size={14} style={{ color: 'var(--color-info)' }} />
                    Operational Baselines
                  </h4>
                  <div className="baseline-list-box">
                    <div className="baseline-row-item">
                      <div className="baseline-row-left"><Layers size={14} /><span>Home Department</span></div>
                      <span className="baseline-row-value">{baseline?.usual_department || 'Unknown'}</span>
                    </div>
                    
                    <div className="baseline-row-item">
                      <div className="baseline-row-left"><Download size={14} /><span>Avg Download Limit</span></div>
                      <span className="baseline-row-value">
                        {baseline?.avg_download_mb != null ? `${baseline.avg_download_mb.toFixed(1)} MB` : '0.0 MB'}
                      </span>
                    </div>
                    
                    <div className="baseline-row-item">
                      <div className="baseline-row-left"><Clock size={14} /><span>Usual Work Hours</span></div>
                      <span className="baseline-row-value">
                        {baseline?.usual_login_hour_start != null && baseline?.usual_login_hour_end != null
                          ? `${String(baseline.usual_login_hour_start).padStart(2, '0')}:00 - ${String(baseline.usual_login_hour_end).padStart(2, '0')}:00`
                          : 'Not logged'}
                      </span>
                    </div>

                    <div className="baseline-row-item">
                      <div className="baseline-row-left"><Laptop size={14} /><span>Known Devices</span></div>
                      <span className="baseline-row-value" title={baseline?.known_devices}>{baseline?.known_devices || 'None'}</span>
                    </div>

                    <div className="baseline-row-item">
                      <div className="baseline-row-left"><Globe size={14} /><span>Known Locations</span></div>
                      <span className="baseline-row-value" title={baseline?.known_locations}>{baseline?.known_locations || 'None'}</span>
                    </div>
                  </div>
                </div>

                {/* Device Trust Registry List */}
                <div style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', margin: '0 0 12px 0' }}>
                    <Laptop size={14} style={{ color: 'var(--color-info)' }} />
                    User Device Trust Registry
                  </h4>
                  <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {devicesList.length === 0 ? (
                      <span style={{ fontSize: '11px', color: '#475569' }}>No devices registered.</span>
                    ) : (
                      devicesList.map(dev => (
                        <div key={dev.device_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#070a12', padding: '8px 10px', borderRadius: '6px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{dev.device_id}</span>
                            <span style={{ color: '#64748b', fontSize: '10px' }}>{dev.device_name}</span>
                          </div>
                          {renderDeviceBadge(dev.status)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section: Download Spikes Area Chart */}
            <div className="chart-section">
              <h4>
                <BarChart2 size={14} style={{ color: 'var(--color-info)' }} />
                Data Transfer Volume vs Baseline Limit
              </h4>
              <div className="chart-container" style={{ height: '160px' }}>
                {chartData.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#64748b' }}>No data transfer history.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSpike" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="shortTime" stroke="#64748b" fontSize={9} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} unit="MB" />
                      <Tooltip
                        contentStyle={{
                          background: '#0d1222',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px'
                        }}
                        labelFormatter={(label, items) => {
                          if (items[0]?.payload) {
                            return `Logged: ${new Date(items[0].payload.timestamp).toLocaleString()}`;
                          }
                          return label;
                        }}
                      />
                      
                      {baseline?.avg_download_mb != null && (
                        <ReferenceLine y={baseline.avg_download_mb} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}>
                          <Label value="Baseline Limit" position="top" fill="#fda4af" fontSize={9} offset={5} />
                        </ReferenceLine>
                      )}

                      <Area type="monotone" dataKey="download" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSpike)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Bottom Section: Historical Anomaly Registry & Investigation Desk */}
            <div className="history-section">
              <h4>
                <Activity size={14} style={{ color: 'var(--color-high)' }} />
                Anomalous Incident History & Investigation workstation
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                {riskHistory.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b' }}>No security flags logged.</p>
                ) : (
                  riskHistory.map((item) => {
                    const isCrit = item.risk_score > 80;
                    const alertStatus = item.status ? item.status.toLowerCase() : 'new';
                    const matchedDevId = getEventDevice(item.event_id);
                    const devTrust = getDeviceTrustStatus(matchedDevId);

                    return (
                      <div key={item.risk_event_id} style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        
                        {/* Incident Header Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>Incident #{item.risk_event_id}</span>
                            {renderRiskCircle(item.risk_score)}
                            {renderStatusBadge(item.status)}
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Flagged: {new Date(item.flagged_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Associated Device Info */}
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94a3b8', alignItems: 'center', background: '#070a12', padding: '6px 10px', borderRadius: '4px' }}>
                          <span>Event Device: <strong>{matchedDevId}</strong></span>
                          <span>|</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Device Trust: {renderDeviceBadge(devTrust)}</span>
                        </div>

                        {/* Rule Match Tags */}
                        <div className="reasons-container" style={{ margin: '4px 0' }}>
                          {item.reasons && item.reasons.length > 0 ? (
                            item.reasons.map((r, i) => (
                              <span key={i} className="reason-pill anomaly">{formatReason(r)}</span>
                            ))
                          ) : (
                            <span className="reason-pill">Baseline Check</span>
                          )}
                        </div>

                        {/* Assignee Operations Block */}
                        <div style={{ background: '#070a12', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(255,255,255,0.01)' }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>✍️ Analyst Investigation Desk</span>
                            
                            {alertStatus === 'new' || alertStatus === 'none' || !item.status ? (
                              <button type="button" className="export-btn" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => handleAssign(item.risk_event_id)}>
                                Assign to me
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Assigned: <strong>{item.assigned_to_analyst || 'Analyst_1'}</strong></span>
                            )}
                          </div>

                          {/* Notes/Comments timeline thread */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                            {parseNotesThread(item.analyst_notes).length === 0 ? (
                              <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>No notes or lifecycle changes logged.</span>
                            ) : (
                              parseNotesThread(item.analyst_notes).map((note, idx) => (
                                <div key={idx} style={{ background: '#0d1222', borderLeft: '3px solid var(--color-info)', padding: '6px 10px', borderRadius: '0 4px 4px 0', fontSize: '11px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', marginBottom: '2px' }}>
                                    <span>Analyst Team</span>
                                    <span>{note.timestamp ? new Date(note.timestamp).toLocaleString() : ''}</span>
                                  </div>
                                  <div style={{ color: '#cbd5e1' }}>{note.text}</div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Note typing textbox */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <textarea
                              placeholder="Type research log or comment..."
                              style={{ flexGrow: 1, background: '#0a0d16', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '8px', resize: 'vertical', height: '42px' }}
                              value={noteInputs[item.risk_event_id] || ''}
                              onChange={e => setNoteInputs(prev => ({ ...prev, [item.risk_event_id]: e.target.value }))}
                            />
                            <button 
                              type="button"
                              className="export-btn" 
                              style={{ padding: '0 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }} 
                              onClick={() => handleAddNote(item.risk_event_id)}
                              disabled={submittingNote[item.risk_event_id]}
                            >
                              {submittingNote[item.risk_event_id] && <span className="spinner-btn" />}
                              Add Note
                            </button>
                          </div>

                          {/* Actions / Resolutions toolbar (only visible if alert is not already resolved) */}
                          {!alertStatus.startsWith('resolved') ? (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '10px' }}>
                              
                              {/* Resolution final note entry textbox */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>Resolution Summary / Closing Statement (Required to resolve):</label>
                                <input
                                  type="text"
                                  placeholder="Provide final explanation to close this alert..."
                                  className="search-input"
                                  style={{ width: '100%', fontSize: '11px', padding: '6px' }}
                                  value={resNotes[item.risk_event_id] || ''}
                                  onChange={e => setResNotes(prev => ({ ...prev, [item.risk_event_id]: e.target.value }))}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button 
                                  type="button"
                                  className="export-btn" 
                                  style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-low)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} 
                                  onClick={() => handleResolve(item.risk_event_id, 'resolved_false_positive')}
                                  disabled={submittingResolve[item.risk_event_id]}
                                >
                                  {submittingResolve[item.risk_event_id] && <span className="spinner-btn" />}
                                  Mark False Positive
                                </button>
                                <button 
                                  type="button"
                                  className="export-btn" 
                                  style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--color-high)', border: '1px solid rgba(244,63,94,0.2)', fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} 
                                  onClick={() => handleResolve(item.risk_event_id, 'resolved_confirmed_threat')}
                                  disabled={submittingResolve[item.risk_event_id]}
                                >
                                  {submittingResolve[item.risk_event_id] && <span className="spinner-btn" />}
                                  Confirm Threat
                                </button>
                                {alertStatus !== 'escalated' && (
                                  <button type="button" className="export-btn" style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)', fontSize: '11px', padding: '6px 12px' }} onClick={() => handleEscalate(item.risk_event_id)}>
                                    Escalate to Head
                                  </button>
                                )}
                              </div>

                            </div>
                          ) : (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '10px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                              This anomalous incident was resolved and closed at {item.resolved_at ? new Date(item.resolved_at).toLocaleString() : 'N/A'}.
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}
      </motion.div>
    </div>
  );
}
