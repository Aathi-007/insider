import React from 'react';
import { Shield, Clock, MapPin, Users } from 'lucide-react';

export default function SocAgentActivity() {
  const analysts = [
    {
      name: 'Analyst_1',
      role: 'Tier 1 Investigator',
      location: 'HQ SOC Console A',
      status: 'active',
      audits: 14,
      shift: 'Day Shift (08:00 - 16:00)'
    },
    {
      name: 'Analyst_2',
      role: 'Tier 2 Incident Response',
      location: 'SOC Floor Terminal 4',
      status: 'active',
      audits: 18,
      shift: 'Evening Shift (16:00 - 24:00)'
    },
    {
      name: 'Admin_Sec',
      role: 'Super Administrator',
      location: 'Secure Remote VPN',
      status: 'active',
      audits: 8,
      shift: 'Standby / Response'
    },
    {
      name: 'Supervisor_9',
      role: 'SOC Floor Manager',
      location: 'HQ Floor Pod C',
      status: 'idle',
      audits: 2,
      shift: 'General Duty (09:00 - 17:00)'
    }
  ];

  return (
    <div className="dashboard-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboard-card-header" style={{ marginBottom: '16px' }}>
        <h2>
          <Users size={18} style={{ color: 'var(--color-info)' }} />
          Active SOC Analyst Roster
        </h2>
      </div>
      <p style={{ fontSize: '11px', color: '#8B95A8', marginBottom: '20px' }}>
        Currently logged-in SOC investigators auditing real-time anomalies.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
        {analysts.map((analyst, index) => (
          <div 
            key={index} 
            style={{ 
              background: '#0a0d16', 
              border: '1px solid rgba(255,255,255,0.02)', 
              borderRadius: '8px', 
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              position: 'relative'
            }}
          >
            {/* Status Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: analyst.status === 'active' ? '#10B981' : '#F59E0B',
                  boxShadow: analyst.status === 'active' ? '0 0 8px #10B981' : '0 0 8px #F59E0B'
                }} />
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#E8EDF5' }}>{analyst.name}</span>
              </div>
              <span style={{ 
                fontSize: '9px', 
                fontWeight: 'bold', 
                background: 'rgba(99,102,241,0.08)', 
                color: '#818CF8', 
                padding: '2px 6px', 
                borderRadius: '4px',
                border: '1px solid rgba(99,102,241,0.15)'
              }}>
                {analyst.role}
              </span>
            </div>

            {/* Analyst Info Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#8B95A8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={11} />
                <span>{analyst.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={11} />
                <span>{analyst.shift}</span>
              </div>
            </div>

            {/* Audits Count */}
            <div style={{ 
              marginTop: '4px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.03)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px'
            }}>
              <span style={{ color: '#64748B' }}>Actions Audited Today</span>
              <span style={{ fontWeight: 'bold', color: '#10B981' }}>{analyst.audits} actions</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
