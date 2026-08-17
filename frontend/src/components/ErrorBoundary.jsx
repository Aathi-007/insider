import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled component crash:", error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100vw',
          background: '#060B14',
          color: '#E8EDF5',
          fontFamily: "'Inter', sans-serif",
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          {/* Radar background lines */}
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
            maxWidth: '480px',
            background: '#0D1526',
            borderRadius: '8px',
            border: '1px solid #1C2942',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            position: 'relative',
            zIndex: 2,
            boxShadow: '0 0 30px rgba(255, 59, 92, 0.05)'
          }}>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #FF3B5C, transparent)'
            }} />

            <div style={{
              padding: '16px',
              borderRadius: '4px',
              background: 'rgba(255, 59, 92, 0.05)',
              border: '1px solid #FF3B5C',
              color: '#FF3B5C',
              boxShadow: '0 0 15px rgba(255, 59, 92, 0.15)'
            }}>
              <ShieldAlert size={40} style={{ strokeWidth: 1.5 }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#E8EDF5', letterSpacing: '0.5px' }}>
                Console Crash Detected
              </h2>
              <p style={{ fontSize: '12px', color: '#8B95A8', margin: 0, lineHeight: '1.5' }}>
                Something went wrong in the rendering system. Telemetry connection is intact, but the visual console has crashed.
              </p>
            </div>

            {this.state.error && (
              <pre style={{
                width: '100%',
                background: '#060B14',
                border: '1px solid #1C2942',
                borderRadius: '4px',
                padding: '12px',
                color: '#FF3B5C',
                fontSize: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                textAlign: 'left',
                overflowX: 'auto',
                maxHeight: '120px'
              }}>
                {this.state.error.toString()}
              </pre>
            )}

            <button
              onClick={this.handleRefresh}
              style={{
                background: 'transparent',
                color: '#00D9FF',
                border: '1.5px solid #00D9FF',
                borderRadius: '4px',
                padding: '10px 20px',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textTransform: 'uppercase',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#00D9FF';
                e.target.style.color = '#060B14';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#00D9FF';
              }}
            >
              <RefreshCw size={12} />
              Re-initialise Console
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
