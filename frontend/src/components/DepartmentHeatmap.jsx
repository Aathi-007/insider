import React from 'react';
import { ShieldAlert, Users, Flame } from 'lucide-react';

export default function DepartmentHeatmap({ alerts }) {
  // 1. Filter alerts for the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentAlerts = alerts.filter(a => {
    if (!a.flagged_at) return false;
    const flaggedDate = new Date(a.flagged_at);
    return flaggedDate >= sevenDaysAgo;
  });

  // 2. Predefined departments to render a clean standard company grid structure
  const deptList = ['Engineering', 'Finance', 'HR', 'IT', 'Sales', 'Operations', 'Legal', 'Marketing'];

  // 3. Count alerts per department
  const counts = {};
  deptList.forEach(d => { counts[d] = 0; });
  
  recentAlerts.forEach(a => {
    const dept = a.department;
    if (dept && deptList.includes(dept)) {
      counts[dept] += 1;
    } else if (dept) {
      // Normalize department match just in case
      const matched = deptList.find(d => d.toLowerCase() === dept.toLowerCase());
      if (matched) {
        counts[matched] += 1;
      }
    }
  });

  const getCellStyles = (count) => {
    if (count <= 2) {
      return {
        bg: '#1E3A5F',
        border: '#2A3548',
        text: '#E8EDF5',
        intensity: 'Low (0-2)'
      };
    }
    if (count <= 5) {
      return {
        bg: '#F59E0B',
        border: 'rgba(245, 158, 11, 0.4)',
        text: '#0B1120',
        intensity: 'Med-Low (3-5)'
      };
    }
    if (count <= 9) {
      return {
        bg: '#F97316',
        border: 'rgba(249, 115, 22, 0.4)',
        text: '#0B1120',
        intensity: 'Med-High (6-9)'
      };
    }
    return {
      bg: '#DC2626',
      border: 'rgba(220, 38, 38, 0.4)',
      text: '#E8EDF5',
      intensity: 'High (10+)'
    };
  };

  const totalRecentCount = recentAlerts.length;
  const maxDept = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h2>
          <Flame size={18} style={{ color: 'var(--color-high)' }} />
          Department Alert Density Heatmap (Last 7 Days)
        </h2>
        <span style={{ fontSize: '11px', color: '#64748b' }}>
          Chronological active log audit window
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: '16px 0 24px 0' }}>
        <div style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Weekly Alerts</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-high)', marginTop: '4px' }}>{totalRecentCount}</div>
        </div>
        <div style={{ background: '#0a0d16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Highest Risk Sector</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: counts[maxDept] > 0 ? '#fff' : '#64748b', marginTop: '6px' }}>
            {counts[maxDept] > 0 ? `${maxDept} (${counts[maxDept]} alerts)` : 'None'}
          </div>
        </div>
      </div>

      {/* Grid Layout Heatmap */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
        gap: '12px', 
        padding: '8px 0' 
      }}>
        {deptList.map(dept => {
          const count = counts[dept];
          const styles = getCellStyles(count);
          return (
            <div 
              key={dept} 
              style={{
                background: styles.bg,
                border: `1px solid ${styles.border}`,
                borderRadius: '8px',
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
                boxShadow: count > 10 ? '0 0 12px rgba(244,63,94,0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                if (count > 0) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = count > 10 ? '0 0 12px rgba(244,63,94,0.3)' : 'none';
              }}
            >
              <div style={{ color: styles.text, fontSize: '14px', fontWeight: 'bold' }}>{dept}</div>
              <div style={{ color: styles.text, fontSize: '32px', fontWeight: '900', margin: '8px 0' }}>{count}</div>
              <div style={{ 
                fontSize: '9px', 
                fontWeight: '800', 
                color: styles.text, 
                opacity: 0.7,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {styles.intensity}
              </div>
            </div>
          );
        })}
      </div>

      {/* Heatmap Legend indicator */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'center', 
        gap: '12px', 
        marginTop: '24px', 
        padding: '12px',
        background: '#0B1120',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#8B95A8'
      }}>
        <span>Density Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', background: '#1E3A5F', border: '1px solid #2A3548', borderRadius: '2px' }} />
          <span>0-2 Alerts (Low)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', background: '#F59E0B', borderRadius: '2px' }} />
          <span>3-5 Alerts (Med-Low)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', background: '#F97316', borderRadius: '2px' }} />
          <span>6-9 Alerts (Med-High)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', background: '#DC2626', borderRadius: '2px' }} />
          <span>10+ Alerts (High)</span>
        </div>
      </div>
    </div>
  );
}
