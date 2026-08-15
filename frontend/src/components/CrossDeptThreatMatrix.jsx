import React from 'react';
import { ArrowRight, ShieldAlert, AlertTriangle } from 'lucide-react';

export default function CrossDeptThreatMatrix({ alerts }) {
  // Extract and process cross department violations from alerts
  const processViolations = () => {
    const flows = {};

    alerts.forEach(alert => {
      const isCrossDept = alert.reasons && alert.reasons.includes('unauthorized_cross_department_access');
      if (isCrossDept && alert.department && alert.accessed_department) {
        const key = `${alert.department}->${alert.accessed_department}`;
        if (!flows[key]) {
          flows[key] = {
            source: alert.department,
            target: alert.accessed_department,
            count: 0,
            sumRisk: 0,
            latest: alert.flagged_at,
            users: new Set()
          };
        }
        flows[key].count += 1;
        flows[key].sumRisk += alert.risk_score;
        flows[key].users.add(alert.user_name);
        if (new Date(alert.flagged_at) > new Date(flows[key].latest)) {
          flows[key].latest = alert.flagged_at;
        }
      }
    });

    return Object.values(flows).map(f => ({
      ...f,
      avgRisk: Math.round(f.sumRisk / f.count),
      uniqueUsers: f.users.size
    })).sort((a, b) => b.count - a.count);
  };

  const violations = processViolations();

  return (
    <div className="dashboard-card" style={{ width: '100%' }}>
      <div className="dashboard-card-header">
        <h2>
          <ShieldAlert size={18} style={{ color: 'var(--color-high)' }} />
          Cross-Department Access Violation Ledgers
        </h2>
        <span style={{ fontSize: '11px', color: '#64748b' }}>
          Real-time auditing of anomalous inter-departmental queries
        </span>
      </div>

      <div className="alerts-table-container" style={{ marginTop: '16px' }}>
        {violations.length === 0 ? (
          <div className="no-data" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            <p>No cross-department access violations registered in the active system logs.</p>
          </div>
        ) : (
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Source Sector</th>
                <th style={{ textAlign: 'center', width: '40px' }}>Vector</th>
                <th>Target Resource Department</th>
                <th>Attempt Count</th>
                <th>Unique Users</th>
                <th>Severity Rate</th>
                <th>Latest Attempt</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((violation, idx) => {
                let riskClass = 'reason-pill';
                let riskStyle = { background: 'var(--color-low-bg)', color: 'var(--color-low)', border: '1px solid rgba(16,185,129,0.2)' };
                
                if (violation.avgRisk > 80) {
                  riskStyle = { background: 'var(--color-high-bg)', color: 'var(--color-high)', border: '1px solid rgba(244,63,94,0.2)' };
                } else if (violation.avgRisk > 60) {
                  riskStyle = { background: 'rgba(245, 158, 11, 0.08)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.15)' };
                }

                return (
                  <tr key={idx}>
                    <td>
                      <span style={{ fontWeight: 'bold', color: '#E8EDF5' }}>{violation.source}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <ArrowRight size={14} style={{ color: 'var(--color-info)' }} />
                    </td>
                    <td>
                      <span style={{ fontWeight: 'bold', color: '#E8EDF5' }}>{violation.target}</span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#fff' }}>{violation.count} attempts</td>
                    <td>{violation.uniqueUsers} users</td>
                    <td>
                      <span className={riskClass} style={riskStyle}>
                        {violation.avgRisk} Risk Score
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(violation.latest).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
