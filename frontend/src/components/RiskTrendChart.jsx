import React from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function RiskTrendChart({ alerts }) {
  // Process the alerts for the trend chart
  // We want to show a chronological trend, so we sort them ascending by flagged_at
  // We limit to the last 15 alerts to keep the chart clean and readable
  const trendData = [...alerts]
    .sort((a, b) => new Date(a.flagged_at) - new Date(b.flagged_at))
    .slice(-15)
    .map((alert, index) => ({
      index: index + 1,
      user: alert.user_name,
      score: alert.risk_score,
      time: new Date(alert.flagged_at).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }));

  return (
    <div className="dashboard-card trend-card">
      <div className="dashboard-card-header" style={{ borderBottom: 'none', padding: '0 0 16px 0' }}>
        <h2>
          <TrendingUp size={18} style={{ color: 'var(--color-info)' }} />
          Threat Escalation Trend
        </h2>
      </div>
      <div className="trend-chart-container">
        {trendData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Waiting for threat logs...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3548" strokeOpacity={0.3} />
              <XAxis 
                dataKey="time" 
                stroke="#8B95A8" 
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="#8B95A8" 
                fontSize={10} 
                tickLine={false}
                domain={[50, 100]}
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
                formatter={(value, name, props) => [
                  `${value} (User: ${props.payload.user})`, 
                  'Risk Score'
                ]}
              />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#6366F1" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRisk)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
