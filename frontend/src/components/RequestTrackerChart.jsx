import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { BarChart2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

export default function RequestTrackerChart({ jwt }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchTrafficTrend() {
      if (!jwt) return;
      try {
        const response = await fetch(`${API_BASE}/analytics/company-behavior-trend`, {
          headers: { 
            'X-API-Key': API_KEY,
            'Authorization': `Bearer ${jwt}`
          }
        });
        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }
        const jsonData = await response.json();
        
        if (isMounted) {
          setData(jsonData);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching request traffic data:", err);
          setError("Traffic feed offline");
          setLoading(false);
        }
      }
    }

    fetchTrafficTrend();
    const interval = setInterval(fetchTrafficTrend, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [jwt]);

  const hasData = data && data.length > 0;

  // Custom tooltips matching the dashboard SOC aesthetic
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Group payload by GET and POST
      const getNorm = payload.find(p => p.dataKey === "get_normal")?.value || 0;
      const getAbnorm = payload.find(p => p.dataKey === "get_abnormal")?.value || 0;
      const postNorm = payload.find(p => p.dataKey === "post_normal")?.value || 0;
      const postAbnorm = payload.find(p => p.dataKey === "post_abnormal")?.value || 0;

      return (
        <div className="custom-chart-tooltip" style={{
          background: '#0d1326',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '8px',
          padding: '12px',
          color: '#fff',
          fontSize: '12px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <p style={{ fontWeight: '600', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
            Time: {label}
          </p>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#3b82f6', fontWeight: '500' }}>GET Requests:</span>
            <div style={{ paddingLeft: '8px' }}>
              <div>Normal: {getNorm}</div>
              <div style={{ color: getAbnorm > 0 ? '#f97316' : '#94a3b8' }}>
                Abnormal: {getAbnorm} {getAbnorm > 0 && '🚨'}
              </div>
            </div>
          </div>
          <div>
            <span style={{ color: '#10b981', fontWeight: '500' }}>POST Requests:</span>
            <div style={{ paddingLeft: '8px' }}>
              <div>Normal: {postNorm}</div>
              <div style={{ color: postAbnorm > 0 ? '#f43f5e' : '#94a3b8' }}>
                Abnormal: {postAbnorm} {postAbnorm > 0 && '🚨'}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-card trend-card">
      <div className="dashboard-card-header" style={{ borderBottom: 'none', padding: '0 0 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>
          <BarChart2 size={18} style={{ color: 'var(--color-info)' }} />
          Request Tracker (GET & POST)
        </h2>
        {hasData && (
          <div className="live-indicator" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <div className="live-dot" style={{ backgroundColor: 'var(--color-low)' }}></div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Realtime</span>
          </div>
        )}
      </div>
      
      <div className="trend-chart-container">
        {error ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--color-high)', fontSize: '13px' }}>{error}</p>
          </div>
        ) : loading && !hasData ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Loading traffic metrics...</p>
          </div>
        ) : !hasData ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '13px' }}>No request logs captured.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis 
                dataKey="displayDate" 
                stroke="#64748b" 
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconSize={10}
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', color: '#64748b' }}
              />
              
              {/* Stacked GET Bar */}
              <Bar 
                dataKey="get_normal" 
                name="GET (Normal)" 
                stackId="get" 
                fill="rgba(59, 130, 246, 0.65)" 
                stroke="var(--color-info)"
                strokeWidth={1}
              />
              <Bar 
                dataKey="get_abnormal" 
                name="GET (Abnormal 🚨)" 
                stackId="get" 
                fill="rgba(249, 115, 22, 0.85)" 
                stroke="var(--color-med)"
                strokeWidth={1}
                radius={[3, 3, 0, 0]}
              />

              {/* Stacked POST Bar */}
              <Bar 
                dataKey="post_normal" 
                name="POST (Normal)" 
                stackId="post" 
                fill="rgba(16, 185, 129, 0.65)" 
                stroke="var(--color-low)"
                strokeWidth={1}
              />
              <Bar 
                dataKey="post_abnormal" 
                name="POST (Abnormal 🚨)" 
                stackId="post" 
                fill="rgba(244, 63, 94, 0.85)" 
                stroke="var(--color-high)"
                strokeWidth={1}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
