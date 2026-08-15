import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

export default function RiskTrendChart() {
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchTrend() {
      try {
        const response = await fetch(`${API_BASE}/analytics/company-behavior-trend`, {
          headers: { 'X-API-Key': API_KEY }
        });
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            const mappedData = data.map(item => ({
              ...item,
              normal_events: (item.get_normal || 0) + (item.post_normal || 0),
              abnormal_events: (item.get_abnormal || 0) + (item.post_abnormal || 0)
            }));
            setTrendData(mappedData);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Failed to fetch company behavior trend", err);
        if (isMounted) setLoading(false);
      }
    }

    fetchTrend();
    const interval = setInterval(fetchTrend, 3000); // refresh every 3 seconds
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="dashboard-card trend-card">
      <div className="dashboard-card-header" style={{ borderBottom: 'none', padding: '0 0 16px 0' }}>
        <h2>
          <TrendingUp size={18} style={{ color: 'var(--color-info)' }} />
          Threat Escalation Trend
        </h2>
      </div>
      <div className="trend-chart-container">
        {loading && trendData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Loading trend data...</p>
          </div>
        ) : trendData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '13px' }}>No behavior data found.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAbnormal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3548" strokeOpacity={0.3} />
              <XAxis 
                dataKey="displayDate" 
                stroke="#8B95A8" 
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="#8B95A8" 
                fontSize={10} 
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#141B2D',
                  border: '1px solid #2A3548',
                  borderRadius: '8px',
                  color: '#E8EDF5',
                  fontSize: '12px'
                }}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Area 
                type="monotone" 
                name="Normal Behavior"
                dataKey="normal_events" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorNormal)" 
              />
              <Area 
                type="monotone" 
                name="Abnormal Behavior"
                dataKey="abnormal_events" 
                stroke="#f43f5e" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorAbnormal)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
