import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, 
  RefreshCw, AlertCircle, ShieldAlert, Filter, ShieldCheck 
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function AlertsTable({ alerts, loading, error, onRowClick, jwt, onRefresh }) {
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Sorting States
  const [sortField, setSortField] = useState('risk_score');
  const [sortDirection, setSortDirection] = useState('desc');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [localAlerts, setLocalAlerts] = useState([]);
  const [localTotalCount, setLocalTotalCount] = useState(0);
  const [localTotalPages, setLocalTotalPages] = useState(1);
  const [localLoading, setLocalLoading] = useState(false);

  // Fetch local alerts from backend using pagination and filters
  useEffect(() => {
    const fetchLocalAlerts = async () => {
      if (!jwt) return;
      setLocalLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString()
        });
        if (searchQuery.trim()) queryParams.append("search", searchQuery.trim());
        if (selectedDept && selectedDept !== "All") queryParams.append("department", selectedDept);
        if (selectedStatus && selectedStatus !== "All") queryParams.append("status", selectedStatus);

        const response = await fetch(`${API_BASE}/alerts?${queryParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${jwt}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setLocalAlerts(data.alerts || []);
          setLocalTotalCount(data.total_count || 0);
          setLocalTotalPages(data.total_pages || 1);
        }
      } catch (err) {
        console.error("Error fetching local paginated alerts:", err);
      } finally {
        setLocalLoading(false);
      }
    };

    fetchLocalAlerts();
    const pollInterval = setInterval(fetchLocalAlerts, 4000);
    return () => clearInterval(pollInterval);
  }, [jwt, currentPage, searchQuery, selectedDept, selectedStatus]);

  // Local state for checking "current time" to compute "NEW" badges dynamically
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Keep local clock updated every second for the "NEW" badge comparison
    const timeTimer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timeTimer);
  }, []);

  // Helper: check if threat flagged in last 10 seconds
  const isNewAlert = (flaggedAtStr) => {
    if (!flaggedAtStr) return false;
    const flaggedDate = new Date(flaggedAtStr);
    const diffMs = now.getTime() - flaggedDate.getTime();
    return diffMs >= 0 && diffMs <= 10000; // 10 seconds threshold
  };

  // Helper to format reasons
  const formatReason = (reason) => {
    if (!reason) return '';
    return reason
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper to format timestamps
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
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

  // Helper: Department styling class mapper
  const getDeptClass = (dept) => {
    if (!dept) return 'default';
    const d = dept.toLowerCase();
    if (d.includes('hr')) return 'hr';
    if (d.includes('fin')) return 'finance';
    if (d.includes('eng')) return 'engineering';
    if (d.includes('sale')) return 'sales';
    if (d.includes('it')) return 'it';
    return 'default';
  };

  // Helper: Get department display abbreviation
  const getDeptAbbrev = (dept) => {
    if (!dept) return '??';
    if (dept.toUpperCase().includes('HR')) return 'HR';
    if (dept.toUpperCase().includes('IT')) return 'IT';
    return dept.substring(0, 2).toUpperCase();
  };

  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending on new field
    }
  };

  const handleAssign = async (e, alertId) => {
    e.stopPropagation();
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
      if (response.ok) {
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Assign error:", err);
    }
  };

const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

  const renderRiskCircle = (score) => {
    const isHigh = score > 80;
    const isMed = score >= 60 && score <= 80;
    const color = isHigh ? '#EF4444' : isMed ? '#F59E0B' : '#10B981';
    const radius = 16;
    const strokeWidth = 3;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    return (
      <div style={{ position: 'relative', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="38" height="38" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="19"
            cy="19"
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="19"
            cy="19"
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
        <span style={{ position: 'absolute', fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
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
        padding: '4px 10px',
        borderRadius: '9999px',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        fontSize: '11px',
        fontWeight: '600',
        color: '#E8EDF5',
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em'
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dotColor
        }} />
        {label}
      </span>
    );
  };

  // Sort localAlerts fetched from backend
  const sortedAlerts = [...localAlerts].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'risk_score') {
      comparison = a.risk_score - b.risk_score;
    } else if (sortField === 'flagged_at') {
      comparison = new Date(a.flagged_at) - new Date(b.flagged_at);
    } else if (sortField === 'user_name') {
      comparison = (a.user_name || '').localeCompare(b.user_name || '');
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination bounds
  const totalItems = localTotalCount;
  const totalPages = localTotalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAlerts = sortedAlerts; // Backend already filtered & paged it!

  // Extract unique departments for dropdown
  const departments = ['All', ...new Set(alerts.map(a => a.department))];
  const statusTabs = ['All', 'New', 'Under Review', 'Escalated', 'Resolved'];

  if (localLoading && localAlerts.length === 0) {
    return (
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--color-high)' }} />
            Threat Detection Register
          </h2>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
                <div className="skeleton-box" style={{ width: '40%', height: '12px' }} />
                <div className="skeleton-box" style={{ width: '20%', height: '8px' }} />
              </div>
              <div className="skeleton-box" style={{ width: '80px', height: '16px' }} />
              <div className="skeleton-box" style={{ width: '60px', height: '16px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h2>
          <ShieldAlert size={18} style={{ color: 'var(--color-high)' }} />
          Threat Detection Register
        </h2>
        <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={12} className="spin-slow" /> Polling Real-Time Logins
        </span>
      </div>

      {/* Filter and Search Bar Toolbar */}
      <div className="table-toolbar" style={{ flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
        
        {/* Status Filtering Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)', width: '100%', paddingBottom: '10px' }}>
          {statusTabs.map(tab => (
            <button
              key={tab}
              type="button"
              style={{
                background: selectedStatus === tab ? 'rgba(59,130,246,0.1)' : 'transparent',
                border: 'none',
                color: selectedStatus === tab ? 'var(--color-info)' : '#64748b',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                setSelectedStatus(tab);
                setCurrentPage(1);
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '12px', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ flexGrow: 1, maxWidth: '400px' }}>
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search user, ID, department..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="filter-actions">
            <Filter size={16} style={{ color: '#64748b' }} />
            <select 
              className="filter-select"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
              }}
            >
              {departments.map((dept, idx) => (
                <option key={idx} value={dept}>
                  {dept === 'All' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && alerts.length === 0 ? (
        <div className="empty-state-container" style={{ padding: '40px 24px' }}>
          <AlertCircle size={32} style={{ color: 'var(--color-high)', marginBottom: '12px' }} />
          <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>SOC Console Connection Error</h4>
          <p style={{ fontSize: '11px', color: '#8B95A8', marginTop: '4px' }}>{error}. Check if your backend server is active.</p>
        </div>
      ) : sortedAlerts.length === 0 ? (
        <div className="empty-state-container" style={{ padding: '60px 24px' }}>
          <ShieldCheck size={36} style={{ color: '#10B981', marginBottom: '12px' }} />
          <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>Sentinel Queue Secure</h4>
          <p style={{ fontSize: '11px', color: '#8B95A8', marginTop: '4px' }}>No alerts match this filter.</p>
          {(selectedStatus !== 'All' || searchQuery !== '' || selectedDept !== 'All') && (
            <button 
              className="export-btn" 
              style={{ marginTop: '16px', background: 'rgba(0, 217, 255, 0.08)', borderColor: '#00D9FF', color: '#00D9FF' }}
              onClick={() => {
                setSelectedStatus('All');
                setSearchQuery('');
                setSelectedDept('All');
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="alerts-table-container">
            <table className="alerts-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('user_name')}>
                    <div className="th-content">
                      User / Profile <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th>Department</th>
                  <th onClick={() => handleSort('risk_score')} title="Risk Score: A weighted combination of rule-based violations and machine learning anomaly indicators.">
                    <div className="th-content">
                      Threat Index <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th>Anomaly Flags</th>
                  <th>Status</th>
                  <th>Assigned Action</th>
                  <th onClick={() => handleSort('flagged_at')}>
                    <div className="th-content">
                      Timestamp <ArrowUpDown size={12} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {paginatedAlerts.map((alert) => {
                    const isHigh = alert.risk_score > 80;
                    const isMed = alert.risk_score >= 60 && alert.risk_score <= 80;
                    const scoreClass = isHigh ? 'high' : isMed ? 'med' : 'low';
                    const isNew = isNewAlert(alert.flagged_at);
                    const alertStatus = alert.status ? alert.status.toLowerCase() : 'new';

                    return (
                      <motion.tr 
                        key={alert.risk_event_id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => {
                          console.log("Row clicked! Selected User ID:", alert.user_id, "Event ID:", alert.risk_event_id);
                          onRowClick(alert.user_id);
                        }}
                        className={isHigh ? 'risk-critical' : isMed ? 'risk-high' : ''}
                      >
                        {/* User Cell with Avatar */}
                        <td>
                          <div className="user-cell-wrapper">
                            <div className={`dept-avatar ${getDeptClass(alert.department)}`}>
                              {getDeptAbbrev(alert.department)}
                            </div>
                            <div className="user-text-info">
                              <span className="user-name-cell">
                                {alert.user_name}
                                {isNew && <span className="new-badge">NEW</span>}
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                ID: {alert.user_id}
                              </span>
                            </div>
                          </div>
                        </td>
                        
                        {/* Department */}
                        <td>{alert.department}</td>
                        {/* Threat Index */}
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {renderRiskCircle(alert.risk_score)}
                          </div>
                        </td>
                        {/* Anomaly pills */}
                        <td>
                          <div className="reasons-container">
                            {alert.reasons && alert.reasons.length > 0 ? (
                              alert.reasons.map((r, idx) => (
                                <span 
                                  key={idx} 
                                  className={`reason-pill ${r.includes('anomaly') || r.includes('download') ? 'anomaly' : ''}`}
                                >
                                  {formatReason(r)}
                                </span>
                              ))
                            ) : (
                              <span className="reason-pill">Baseline Checked</span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>{renderStatusBadge(alert.status)}</td>

                        {/* Assignee / Actions Button */}
                        <td>
                          {alertStatus === 'new' || alertStatus === 'none' || !alert.status ? (
                            <button
                              type="button"
                              className="export-btn"
                              style={{ padding: '2px 8px', fontSize: '10px', height: '24px', whiteSpace: 'nowrap' }}
                              onClick={(e) => handleAssign(e, alert.risk_event_id)}
                            >
                              Assign to me
                            </button>
                          ) : alertStatus === 'under_review' ? (
                            <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              👤 {alert.assigned_to_analyst || 'Analyst_1'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#475569' }}>-</span>
                          )}
                        </td>
                        
                        {/* Flagged Time */}
                        <td className="timestamp-text">
                          {formatTime(alert.flagged_at)}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="table-pagination">
            <span className="pagination-info">
              Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong>{totalItems}</strong> entries
            </span>
            <div className="pagination-controls">
              <button 
                className="pagination-btn"
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button 
                className="pagination-btn"
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
