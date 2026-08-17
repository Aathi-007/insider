import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame, PieChart as PieIcon } from 'lucide-react';

export default function DepartmentHeatmap({ alerts }) {
  // Predefined department list and colors matching the brand identity
  const DEPT_COLORS = {
    'Engineering': '#60A5FA', // Blue
    'Finance': '#4ADE80',     // Green
    'HR': '#FF6EC7',          // Pink
    'IT': '#00D9FF',          // Cyan
    'Sales': '#FBBF24',        // Amber
    'Operations': '#A855F7',   // Purple
    'Legal': '#EF4444',        // Red
    'Marketing': '#94A3B8'     // Muted
  };

  // Count active threats per department
  const counts = {};
  Object.keys(DEPT_COLORS).forEach(d => { counts[d] = 0; });
  
  alerts.forEach(a => {
    const dept = a.department;
    if (dept && DEPT_COLORS[dept] !== undefined) {
      counts[dept] += 1;
    } else if (dept) {
      const matched = Object.keys(DEPT_COLORS).find(d => d.toLowerCase() === dept.toLowerCase());
      if (matched) counts[matched] += 1;
    }
  });

  // Convert to Recharts data array and filter out departments with 0 alerts
  const data = Object.keys(counts)
    .map(name => ({
      name,
      value: counts[name],
      color: DEPT_COLORS[name]
    }))
    .filter(item => item.value > 0);

  const totalAlerts = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const percentage = totalAlerts > 0 ? ((dataPoint.value / totalAlerts) * 100).toFixed(1) : 0;
      return (
        <div style={{
          background: '#0D1526',
          border: `1.5px solid ${dataPoint.color}`,
          borderRadius: '4px',
          padding: '10px 14px',
          fontSize: '11px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          fontFamily: "'JetBrains Mono', monospace"
        }}>
          <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>{dataPoint.name} Department</div>
          <div style={{ color: dataPoint.color, display: 'flex', gap: '8px' }}>
            <span>Threats: <strong>{dataPoint.value}</strong></span>
            <span>Ratio: <strong>{percentage}%</strong></span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-card" style={{ height: '100%' }}>
      <div className="dashboard-card-header">
        <h2>
          <PieIcon size={18} style={{ color: '#00D9FF' }} />
          Department Threat Distribution Matrix
        </h2>
        <span style={{ fontSize: '11px', color: '#64748b' }}>
          Real-time alerts segmentations
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', padding: '24px', flexGrow: 1, alignItems: 'center' }}>
        
        {/* Pie Chart display */}
        <div style={{ height: '240px', width: '100%', position: 'relative' }}>
          {totalAlerts > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      style={{ filter: `drop-shadow(0 0 4px ${entry.color}40)`, outline: 'none' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B95A8', fontSize: '12px' }}>
              No threat telemetry logged.
            </div>
          )}
          
          {/* Centered Total Alerts count */}
          {totalAlerts > 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#8B95A8' }}>Total Logs</span>
              <span className="mono-text" style={{ display: 'block', fontSize: '24px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{totalAlerts}</span>
            </div>
          )}
        </div>

        {/* Legend sidebar details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
          {totalAlerts > 0 ? (
            data.map(item => {
              const percentage = ((item.value / totalAlerts) * 100).toFixed(1);
              return (
                <div 
                  key={item.name} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#060B14',
                    border: '1px solid rgba(255,255,255,0.02)',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                    <span style={{ color: '#E8EDF5', fontWeight: '600' }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                    <span style={{ color: item.color }}>{item.value} Alerts</span>
                    <span style={{ color: '#8B95A8' }}>{percentage}%</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ fontSize: '11px', color: '#8B95A8', textAlign: 'center' }}>No active sector distribution metrics.</p>
          )}
        </div>

      </div>
    </div>
  );
}
