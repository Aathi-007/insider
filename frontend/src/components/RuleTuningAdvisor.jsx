import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-local-key';

export default function RuleTuningAdvisor({ jwt }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/rule-accuracy`, {
        headers: {
          'X-API-Key': API_KEY,
          'Authorization': `Bearer ${jwt}`
        }
      });
      if (response.ok) {
        const raw = await response.json();
        const list = Object.keys(raw).map(key => ({
          rawName: key,
          name: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          fpRate: raw[key].false_positive_rate || 0,
          total: raw[key].total_resolved || 0
        }));
        setData(list);
      }
    } catch (err) {
      console.error("Advisor failed to load rule metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [jwt]);

  if (loading) {
    return (
      <div className="dashboard-card" style={{ height: '100%' }}>
        <p style={{ color: '#8B95A8', fontSize: '12px' }}>Loading advisor suggestions...</p>
      </div>
    );
  }

  // Filter high noise rules
  const noiseRules = data.filter(r => r.fpRate > 50 && r.total > 0);
  const optimalRules = data.filter(r => r.fpRate <= 50 || r.total === 0);

  return (
    <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboard-card-header" style={{ marginBottom: '16px' }}>
        <h2>
          <Lightbulb size={18} style={{ color: '#FBBF24' }} />
          Heuristics Policy Tuning Advisor
        </h2>
      </div>
      <p style={{ fontSize: '11px', color: '#8B95A8', marginBottom: '20px' }}>
        Automated recommendations to reduce False Positive alert rates.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
        {/* Tuning Recommendations */}
        {noiseRules.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-high)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Action Required ({noiseRules.length} rules)
            </span>
            {noiseRules.map(rule => (
              <div 
                key={rule.rawName}
                style={{ 
                  background: 'rgba(239, 68, 68, 0.04)', 
                  border: '1px solid rgba(239, 68, 68, 0.15)', 
                  borderRadius: '8px', 
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{rule.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-high)', background: 'var(--color-high-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                    {rule.fpRate.toFixed(0)}% FP
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                  ⚠️ <strong>Advisor suggestion:</strong> False positive rate exceeds threshold. Raise heuristic trigger parameter by 15-20% (e.g. increase size threshold or limit timezone alerts to non-business days).
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Optimal Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-low)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Performing Optimally ({optimalRules.length} rules)
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {optimalRules.map(rule => (
              <div 
                key={rule.rawName}
                style={{ 
                  background: '#0a0d16', 
                  border: '1px solid rgba(255,255,255,0.02)', 
                  borderRadius: '6px', 
                  padding: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--color-low)' }} />
                  <span style={{ fontSize: '12px', color: '#E8EDF5' }}>{rule.name}</span>
                </div>
                <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 'bold' }}>
                  {rule.total === 0 ? 'No Data' : `${rule.fpRate.toFixed(0)}% FP`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
