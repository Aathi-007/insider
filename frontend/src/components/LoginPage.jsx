import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertCircle, Key, User } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function LoginPage({ setJwt }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detectedRole, setDetectedRole] = useState('employee');



  // Dynamically determine role indicator based on credentials typed
  useEffect(() => {
    const userLower = username.trim().toLowerCase();
    if (userLower === 'admin' || userLower === 'admin1') {
      setDetectedRole('System Administrator');
    } else if (userLower === 'analyst' || userLower === 'analyst1') {
      setDetectedRole('Security Analyst');
    } else if (userLower) {
      setDetectedRole('Standard Employee (Monitored)');
    } else {
      setDetectedRole('Enter credentials...');
    }
  }, [username]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Credentials required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Invalid credentials. Access denied.");
      }
      
      // Store token in sessionStorage for refresh persistence
      sessionStorage.setItem('ueba_jwt', data.access_token);
      setJwt(data.access_token);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: '#060B14',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999,
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Background Radar Grid Pattern */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(15, 26, 46, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 26, 46, 0.5) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        pointerEvents: 'none',
        zIndex: 1
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#0D1526',
        borderRadius: '8px',
        border: '1px solid #1C2942',
        boxShadow: '0 0 20px rgba(0, 217, 255, 0.05), inset 0 0 10px rgba(0, 217, 255, 0.02)',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Animated LED status line */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #00D9FF, transparent)'
        }} />

        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '4px',
            background: 'rgba(0, 217, 255, 0.05)',
            border: '1px solid #00D9FF',
            color: '#00D9FF',
            boxShadow: '0 0 15px rgba(0, 217, 255, 0.2)'
          }}>
            <ShieldAlert size={32} style={{ strokeWidth: 1.5 }} />
          </div>
          
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#E8EDF5', margin: '8px 0 0 0', letterSpacing: '0.5px' }}>
            UEBA Insider Threat Console
          </h2>
          <div style={{ fontSize: '11px', color: '#8B95A8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Authorized Personnel Only
          </div>
        </div>

        {/* Warning text */}
        <div style={{
          padding: '12px',
          background: 'rgba(251, 122, 60, 0.03)',
          border: '1px solid rgba(251, 122, 60, 0.15)',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#FB7A3C',
          lineHeight: '1.4'
        }}>
          Access restricted to authorized Security Analysts and System Administrators only. Unauthorized access attempts are logged.
        </div>



        {/* Error notification */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(255, 59, 92, 0.08)',
            border: '1px solid rgba(255, 59, 92, 0.2)',
            borderRadius: '4px',
            color: '#FF3B5C',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={14} />
            <span style={{ fontWeight: 'bold' }}>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Enter analyst/admin username..." 
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 36px',
                  background: '#060B14',
                  border: '1px solid #2A3548',
                  borderRadius: '4px',
                  color: '#E8EDF5',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00D9FF'}
                onBlur={(e) => e.target.style.borderColor = '#2A3548'}
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
              <User size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8B95A8' }} />
            </div>
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B95A8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                placeholder="Enter password..." 
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 36px',
                  background: '#060B14',
                  border: '1px solid #2A3548',
                  borderRadius: '4px',
                  color: '#E8EDF5',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00D9FF'}
                onBlur={(e) => e.target.style.borderColor = '#2A3548'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
              <Key size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8B95A8' }} />
            </div>
          </div>

          {/* Login Clearance Indicator */}
          <div style={{
            fontSize: '11px',
            color: '#8B95A8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #1C2942',
            paddingTop: '12px',
            marginTop: '4px'
          }}>
            <span>Detected Clearance:</span>
            <span style={{ 
              fontWeight: 'bold', 
              fontFamily: "'JetBrains Mono', monospace",
              color: detectedRole.includes('Admin') ? '#FB7A3C' : detectedRole.includes('Analyst') ? '#00D9FF' : '#8B95A8' 
            }}>{detectedRole}</span>
          </div>

          {/* Submit */}
          <button 
            type="submit" 
            style={{
              width: '100%',
              background: 'transparent',
              color: '#00D9FF',
              border: '1.5px solid #00D9FF',
              borderRadius: '4px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: 'bold',
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#00D9FF';
              e.target.style.color = '#060B14';
              e.target.style.boxShadow = '0 0 15px rgba(0, 217, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = '#00D9FF';
              e.target.style.boxShadow = 'none';
            }}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Authenticate Terminal Gate'}
          </button>
        </form>


      </div>
    </div>
  );
}
