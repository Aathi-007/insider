import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip
} from 'recharts';
import { ShieldAlert, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

const RenderRadarDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  const isOverThreshold = payload.fpRate > 50 && payload.total > 0;
  if (isOverThreshold) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={5} fill="#EF4444" stroke="#ffffff" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={8} fill="none" stroke="#EF4444" strokeWidth={1} opacity={0.4} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill="#6366F1" />;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

export default function RuleAccuracyPanel({ jwt }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccuracy = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/rule-accuracy`, {
        headers: {
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }
      const raw = await response.json();
      
      // Transform raw dict to chart list
      const list = Object.keys(raw).map(key => {
        const item = raw[key];
        return {
          rawName: key,
          name: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          fpRate: item.false_positive_rate || 0,
          total: item.total_resolved || 0,
          confirmed: item.confirmed_threat_count || 0,
          fpCount: item.false_positive_count || 0
        };
      });
      setData(list);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Failed to load accuracy metrics.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccuracy();
  }, [jwt]);

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Analyzing detection tuning stats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card">
        <div className="no-data">
          <AlertTriangle size={24} style={{ color: 'var(--color-high)', marginBottom: '8px' }} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const needsReviewCount = data.filter(d => d.fpRate > 50 && d.total > 0).length;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h2>
          <ShieldAlert size={18} style={{ color: 'var(--color-info)' }} />
          Detection Rule Tuning & Accuracy (False Positive Rate)
        </h2>
        <button className="export-btn" onClick={fetchAccuracy} style={{ padding: '4px 10px', fontSize: '11px' }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px', marginTop: '12px' }}>
        <div style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rules Tracked</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{data.length}</div>
        </div>
        <div style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High Noise Rules (&gt;50% FP)</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: needsReviewCount > 0 ? 'var(--color-high)' : 'var(--color-low)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {needsReviewCount}
            {needsReviewCount > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          </div>
        </div>
      </div>

      <div style={{ height: '320px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
            <defs>
              <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <PolarGrid stroke="#2A3548" strokeOpacity={0.3} />
            <PolarAngleAxis dataKey="name" stroke="#8B95A8" fontSize={9} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#8B95A8" fontSize={8} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#141B2D',
                border: '1px solid #2A3548',
                borderRadius: '8px',
                color: '#E8EDF5',
                fontSize: '12px'
              }}
              formatter={(value, name, props) => {
                const payload = props.payload;
                return [
                  <div>
                    <span style={{ fontWeight: 'bold', color: value > 50 ? 'var(--color-high)' : 'var(--color-low)' }}>{value.toFixed(1)}%</span>
                    <div style={{ fontSize: '10px', color: '#8B95A8', marginTop: '4px' }}>
                      Resolved: {payload.total} | FP: {payload.fpCount} | Confirmed: {payload.confirmed}
                    </div>
                  </div>,
                  'False Positive Rate'
                ];
              }}
            />
            <Radar 
              name="False Positive Rate" 
              dataKey="fpRate" 
              stroke="#6366F1" 
              strokeWidth={2}
              fill="url(#radarGrad)" 
              fillOpacity={0.3}
              dot={<RenderRadarDot />}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="alerts-table-container" style={{ marginTop: '24px' }}>
        <table className="alerts-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Total Resolved Alerts</th>
              <th>False Positives</th>
              <th>Confirmed Threats</th>
              <th>False Positive Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((rule) => {
              const isOver = rule.fpRate > 50 && rule.total > 0;
              return (
                <tr key={rule.rawName}>
                  <td style={{ fontWeight: 'bold' }}>{rule.name}</td>
                  <td>{rule.total}</td>
                  <td style={{ color: 'var(--color-med)' }}>{rule.fpCount}</td>
                  <td style={{ color: 'var(--color-high)' }}>{rule.confirmed}</td>
                  <td style={{ fontWeight: 'bold', color: isOver ? 'var(--color-high)' : 'var(--color-low)' }}>
                    {rule.fpRate.toFixed(1)}%
                  </td>
                  <td>
                    {rule.total === 0 ? (
                      <span className="reason-pill" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.05)' }}>No Data</span>
                    ) : isOver ? (
                      <span className="reason-pill" style={{ background: 'var(--color-high-bg)', color: 'var(--color-high)', border: '1px solid rgba(244,63,94,0.2)' }}>Needs Tuning</span>
                    ) : (
                      <span className="reason-pill" style={{ background: 'var(--color-low-bg)', color: 'var(--color-low)', border: '1px solid rgba(16,185,129,0.2)' }}>Optimal</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
