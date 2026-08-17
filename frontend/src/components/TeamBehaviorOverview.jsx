import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Coins, Code, ShieldAlert, Cpu, 
  BadgePercent, AlertTriangle, Activity, 
  ArrowUpRight, ArrowDownRight, ArrowRight 
} from 'lucide-react';

import { fetchWithRetry } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

const DEPARTMENTS = {
  HR: {
    name: 'HR',
    icon: Users,
    color: 'var(--avatar-hr)', // Pink
    rgb: '236, 72, 153',
  },
  Finance: {
    name: 'Finance',
    icon: Coins,
    color: 'var(--avatar-finance)', // Emerald/Green
    rgb: '16, 185, 129',
  },
  Engineering: {
    name: 'Engineering',
    icon: Code,
    color: 'var(--avatar-engineering)', // Blue
    rgb: '59, 130, 246',
  },
  Sales: {
    name: 'Sales',
    icon: BadgePercent,
    color: 'var(--avatar-sales)', // Amber/Yellow
    rgb: '245, 158, 11',
  },
  IT: {
    name: 'IT',
    icon: Cpu,
    color: 'var(--avatar-it)', // Cyan
    rgb: '6, 182, 212',
  }
};

// Helper to format reasons into user friendly Title Case
const formatReason = (reason) => {
  if (!reason) return 'Unknown Alert';
  return reason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function TeamBehaviorOverview({ alerts, jwt }) {
  const [timeRange, setTimeRange] = useState('week'); // 'week' | 'month' | 'all'
  const [expandedDept, setExpandedDept] = useState(null); // String deptKey or null
  const [apiData, setApiData] = useState(null);
  const [apiLoading, setApiLoading] = useState(true);

  const now = new Date();

  // Fetch department behavior calculations from the backend
  useEffect(() => {
    async function fetchBehaviour() {
      if (!jwt) return;
      try {
        const rangeParam = timeRange === 'week' ? 'week' : timeRange === 'month' ? 'month' : 'alltime';
        const response = await fetchWithRetry(`${API_BASE}/analytics/department-behaviour?range=${rangeParam}`, {
          headers: {
            'X-API-Key': API_KEY,
            'Authorization': `Bearer ${jwt}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setApiData(data);
        }
      } catch (err) {
        console.error("Error fetching backend department behaviour:", err);
      } finally {
        setApiLoading(false);
      }
    }
    fetchBehaviour();
    const interval = setInterval(fetchBehaviour, 10000);
    return () => clearInterval(interval);
  }, [timeRange, jwt]);

  // Filter alerts by time range (Local fallback)
  const getFilteredAlerts = (range) => {
    if (range === 'all') return alerts;
    const days = range === 'week' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - days);
    return alerts.filter(a => {
      if (!a.flagged_at) return false;
      const flaggedDate = new Date(a.flagged_at);
      return flaggedDate >= cutoff;
    });
  };

  const filteredAlerts = getFilteredAlerts(timeRange);

  // Compute metrics for a specific department (Local fallback)
  const calculateDeptMetricsLocal = (deptKey) => {
    const deptName = DEPARTMENTS[deptKey].name;

    // Filter alerts for this department in the current range
    const deptAlerts = filteredAlerts.filter(a => {
      if (!a.department) return false;
      return a.department.toLowerCase() === deptName.toLowerCase();
    });

    // Calculate current health score (100 - average risk score)
    let healthScore = 100;
    if (deptAlerts.length > 0) {
      const sumRisk = deptAlerts.reduce((sum, a) => sum + a.risk_score, 0);
      const avgRisk = sumRisk / deptAlerts.length;
      healthScore = Math.max(0, Math.round(100 - avgRisk));
    }

    // Calculate trend: this week vs last week
    const thisWeekCutoff = new Date();
    thisWeekCutoff.setDate(now.getDate() - 7);
    const thisWeekAlerts = alerts.filter(a => {
      if (!a.department || !a.flagged_at) return false;
      if (a.department.toLowerCase() !== deptName.toLowerCase()) return false;
      return new Date(a.flagged_at) >= thisWeekCutoff;
    });

    let thisWeekHealth = 100;
    if (thisWeekAlerts.length > 0) {
      const sumRisk = thisWeekAlerts.reduce((sum, a) => sum + a.risk_score, 0);
      thisWeekHealth = Math.max(0, Math.round(100 - (sumRisk / thisWeekAlerts.length)));
    }

    const lastWeekCutoffStart = new Date();
    lastWeekCutoffStart.setDate(now.getDate() - 14);
    const lastWeekCutoffEnd = new Date();
    lastWeekCutoffEnd.setDate(now.getDate() - 7);

    const lastWeekAlerts = alerts.filter(a => {
      if (!a.department || !a.flagged_at) return false;
      if (a.department.toLowerCase() !== deptName.toLowerCase()) return false;
      const d = new Date(a.flagged_at);
      return d >= lastWeekCutoffStart && d < lastWeekCutoffEnd;
    });

    let lastWeekHealth = 100;
    if (lastWeekAlerts.length > 0) {
      const sumRisk = lastWeekAlerts.reduce((sum, a) => sum + a.risk_score, 0);
      lastWeekHealth = Math.max(0, Math.round(100 - (sumRisk / lastWeekAlerts.length)));
    }

    const trendDiff = thisWeekHealth - lastWeekHealth;

    // Count unresolved high-risk alerts (risk_score > 80, unresolved status)
    const unresolvedHighRiskCount = alerts.filter(a => {
      if (!a.department) return false;
      if (a.department.toLowerCase() !== deptName.toLowerCase()) return false;
      const isHighRisk = a.risk_score > 80;
      const isUnresolved = !a.status || !a.status.startsWith('resolved');
      return isHighRisk && isUnresolved;
    }).length;

    // Top 3 reasons this week (last 7 days)
    const reasonCounts = {};
    thisWeekAlerts.forEach(a => {
      if (a.reasons) {
        a.reasons.forEach(r => {
          if (r) {
            reasonCounts[r] = (reasonCounts[r] || 0) + 1;
          }
        });
      }
    });

    const topReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Sparkline data for the last 14 days
    const sparklineData = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayStart = new Date(d.setHours(0, 0, 0, 0));
      const dayEnd = new Date(d.setHours(23, 59, 59, 999));

      const dayAlerts = alerts.filter(a => {
        if (!a.department || !a.flagged_at) return false;
        if (a.department.toLowerCase() !== deptName.toLowerCase()) return false;
        const flagged = new Date(a.flagged_at);
        return flagged >= dayStart && flagged <= dayEnd;
      });

      let dayScore = 0;
      if (dayAlerts.length > 0) {
        const sum = dayAlerts.reduce((sum, a) => sum + a.risk_score, 0);
        dayScore = Math.round(sum / dayAlerts.length);
      }
      sparklineData.push(dayScore);
    }

    return {
      healthScore,
      trendDiff,
      unresolvedHighRiskCount,
      topReasons,
      sparklineData
    };
  };

  const deptKeys = Object.keys(DEPARTMENTS);
  
  // Resolve data source: backend API or local calculation fallback
  const resolvedMetrics = {};
  deptKeys.forEach(key => {
    const local = calculateDeptMetricsLocal(key);
    
    // Active / resolved count calculations are always run client-side for immediate responsiveness
    const deptName = DEPARTMENTS[key].name;
    const deptAlerts = filteredAlerts.filter(a => a.department && a.department.toLowerCase() === deptName.toLowerCase());
    const activeCount = deptAlerts.filter(a => !a.status || !a.status.startsWith('resolved')).length;
    const resolvedCount = deptAlerts.filter(a => a.status && a.status.startsWith('resolved')).length;

    if (apiData && apiData.departments && apiData.departments[deptName]) {
      const apiDept = apiData.departments[deptName];
      resolvedMetrics[key] = {
        healthScore: apiDept.behaviour_health_score,
        trendDiff: apiDept.trend_change_points,
        unresolvedHighRiskCount: apiDept.active_high_risk_count,
        topReasons: apiDept.top_3_reasons,
        sparklineData: apiDept.sparkline_data,
        activeCount,
        resolvedCount
      };
    } else {
      resolvedMetrics[key] = {
        ...local,
        activeCount,
        resolvedCount
      };
    }
  });

  // Callout Row Badge Content resolution
  let improvedPillText = "";
  let attentionPillText = "";

  if (apiData) {
    const mi = apiData.most_improved_department;
    if (mi) {
      if (mi.change !== undefined && mi.change > 0) {
        improvedPillText = `🎉 Most Improved: ${mi.name} (+${mi.change} pts)`;
      } else {
        improvedPillText = `🏆 Top Performer: ${mi.name} (${mi.score} pts)`;
      }
    }

    const na = apiData.needs_attention_department;
    if (na) {
      if (na.change !== undefined && na.change < 0) {
        attentionPillText = `⚠️ Needs Attention: ${na.name} (${na.change} pts)`;
      } else {
        attentionPillText = `⚠️ Needs Attention: ${na.name} (Score: ${na.score})`;
      }
    }
  } else {
    // Local Fallback Calculations
    let mostImprovedDept = null;
    let maxImprovement = -Infinity;
    deptKeys.forEach(key => {
      const diff = resolvedMetrics[key].trendDiff;
      if (diff > maxImprovement) {
        maxImprovement = diff;
        mostImprovedDept = key;
      }
    });

    let needsAttentionDept = null;
    let minImprovement = Infinity;
    deptKeys.forEach(key => {
      const diff = resolvedMetrics[key].trendDiff;
      if (diff < minImprovement) {
        minImprovement = diff;
        needsAttentionDept = key;
      }
    });

    if (maxImprovement > 0) {
      improvedPillText = `🎉 Most Improved: ${DEPARTMENTS[mostImprovedDept].name} (+${maxImprovement} pts)`;
    } else {
      let topDept = deptKeys[0];
      let maxScore = -Infinity;
      deptKeys.forEach(key => {
        if (resolvedMetrics[key].healthScore > maxScore) {
          maxScore = resolvedMetrics[key].healthScore;
          topDept = key;
        }
      });
      improvedPillText = `🏆 Top Performer: ${DEPARTMENTS[topDept].name} (${maxScore} pts)`;
    }

    if (minImprovement < 0) {
      attentionPillText = `⚠️ Needs Attention: ${DEPARTMENTS[needsAttentionDept].name} (${minImprovement} pts)`;
    } else {
      let worstDept = deptKeys[0];
      let minScore = Infinity;
      deptKeys.forEach(key => {
        if (resolvedMetrics[key].healthScore < minScore) {
          minScore = resolvedMetrics[key].healthScore;
          worstDept = key;
        }
      });
      attentionPillText = `⚠️ Needs Attention: ${DEPARTMENTS[worstDept].name} (Score: ${minScore})`;
    }
  }

  // Accordion toggle handler
  const handleCardClick = (deptKey) => {
    if (expandedDept === deptKey) {
      setExpandedDept(null);
    } else {
      setExpandedDept(deptKey);
    }
  };

  // Inline SVG Sparkline Renderer
  const renderSparkline = (data, color) => {
    if (!data || data.length === 0) return null;
    const width = 100;
    const height = 30;
    const padding = 2;
    
    const maxVal = Math.max(...data, 40); // scale up, minimum height limit
    const minVal = 0;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 2 * padding) + padding;
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding) - padding;
      return { x, y };
    });

    const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

    const gradientId = `sparkline-grad-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className="scorecard-panel">
      {/* 1. Header controls */}
      <div className="scorecard-header-row">
        <div className="scorecard-title-group">
          <Activity size={20} style={{ color: '#6366F1' }} />
          <div>
            <h2>Team Behaviour Scorecards</h2>
            <span className="scorecard-title-desc">Critical at-a-glance security posture by division</span>
          </div>
        </div>

        <div className="scorecard-controls">
          <div className="scorecard-toggle-group">
            <button 
              className={`scorecard-toggle-btn ${timeRange === 'week' ? 'active' : ''}`}
              onClick={() => setTimeRange('week')}
            >
              This Week
            </button>
            <button 
              className={`scorecard-toggle-btn ${timeRange === 'month' ? 'active' : ''}`}
              onClick={() => setTimeRange('month')}
            >
              This Month
            </button>
            <button 
              className={`scorecard-toggle-btn ${timeRange === 'all' ? 'active' : ''}`}
              onClick={() => setTimeRange('all')}
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* 2. Callout badge row */}
      <div className="scorecard-callout-row">
        <div className="scorecard-callout-badge improved">
          {improvedPillText}
        </div>
        <div className="scorecard-callout-badge attention">
          {attentionPillText}
        </div>
      </div>

      {/* 3. Cards scorecards grid */}
      <div className="scorecard-grid">
        {deptKeys.map(key => {
          const dept = DEPARTMENTS[key];
          const metrics = resolvedMetrics[key];
          const IconComponent = dept.icon;

          // Determine color & health status thresholds
          let healthColor = '#10B981'; // Good (>80)
          let standingClass = 'good-standing';

          if (metrics.healthScore < 50) {
            healthColor = '#EF4444'; // Bad (<50)
            standingClass = 'critical-standing';
          } else if (metrics.healthScore <= 80) {
            healthColor = '#F59E0B'; // Moderate (50-80)
            standingClass = 'moderate-standing';
          }

          // Custom radial gradient per department color at low opacity
          const radialBgStyle = {
            background: `radial-gradient(circle at 10% 20%, rgba(${dept.rgb}, 0.06) 0%, rgba(15, 23, 42, 0.96) 95%)`
          };

          return (
            <div 
              key={key} 
              className={`scorecard-card ${standingClass}`}
              style={radialBgStyle}
              onClick={() => handleCardClick(key)}
            >
              {/* 3.1 Unresolved high risk notifications badge */}
              {metrics.unresolvedHighRiskCount >= 3 && (
                <div className="scorecard-warning-badge" title={`${metrics.unresolvedHighRiskCount} unresolved high risk events`}>
                  <AlertTriangle size={11} />
                  <span>{metrics.unresolvedHighRiskCount}</span>
                </div>
              )}

              {/* 3.2 Card Header */}
              <div className="scorecard-card-header">
                <div className="scorecard-dept-info">
                  <div className="scorecard-dept-icon" style={{ color: dept.color }}>
                    <IconComponent size={16} />
                  </div>
                  <span className="scorecard-dept-name">{dept.name}</span>
                </div>

                {/* Week vs Last week Trend Indicator */}
                <div className={`scorecard-trend-badge ${metrics.trendDiff > 0 ? 'up' : metrics.trendDiff < 0 ? 'down' : 'flat'}`}>
                  {metrics.trendDiff > 0 ? (
                    <>
                      <ArrowUpRight size={12} />
                      <span>+{metrics.trendDiff}</span>
                    </>
                  ) : metrics.trendDiff < 0 ? (
                    <>
                      <ArrowDownRight size={12} />
                      <span>{metrics.trendDiff}</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight size={12} />
                      <span>0</span>
                    </>
                  )}
                </div>
              </div>

              {/* 3.3 Card Body (Score + sparkline) */}
              <div className="scorecard-card-body">
                <div className="scorecard-metric-block">
                  <span className="scorecard-metric-label" title="Behaviour Health Score: A health rating from 0-100 indicating the safety and compliance level of user activities, where higher is better.">Behaviour Health</span>
                  <span className="scorecard-health-value" style={{ color: healthColor }}>
                    {metrics.healthScore}
                  </span>
                </div>

                <div className="scorecard-sparkline-container" title="14-day risk score trend">
                  {renderSparkline(metrics.sparklineData, dept.color)}
                </div>
              </div>

              {/* 3.4 Card Expanded content (drill down) */}
              <AnimatePresence initial={false}>
                {expandedDept === key && (
                  <motion.div
                    className="scorecard-expanded-wrapper"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    onClick={(e) => e.stopPropagation()} // stop toggle when clicking details
                  >
                    {/* Active vs Resolved Counts */}
                    <div className="scorecard-sub-metrics">
                      <div className="scorecard-sub-card">
                        <span className="scorecard-sub-label">Active Alerts</span>
                        <span className="scorecard-sub-value active-count">{metrics.activeCount}</span>
                      </div>
                      <div className="scorecard-sub-card">
                        <span className="scorecard-sub-label">Resolved</span>
                        <span className="scorecard-sub-value resolved-count">{metrics.resolvedCount}</span>
                      </div>
                    </div>

                    {/* Top Flagged reasons */}
                    <div className="scorecard-reasons-section">
                      <span className="scorecard-reasons-label">Top Flags</span>
                      <div className="scorecard-reasons-list">
                        {metrics.topReasons.length === 0 ? (
                          <div className="scorecard-reason-item" style={{ borderLeftColor: '#475569' }}>
                            <span className="scorecard-reason-text" style={{ color: '#64748B' }}>No anomalies recorded</span>
                          </div>
                        ) : (
                          metrics.topReasons.map(({ reason, count }) => (
                            <div key={reason} className="scorecard-reason-item" style={{ borderLeftColor: dept.color }}>
                              <span className="scorecard-reason-bullet" style={{ backgroundColor: dept.color }} />
                              <span className="scorecard-reason-text" title={formatReason(reason)}>
                                {formatReason(reason)}
                              </span>
                              <span className="scorecard-reason-count">{count}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
