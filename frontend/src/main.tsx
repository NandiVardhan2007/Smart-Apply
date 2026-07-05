import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      if (import.meta.env.DEV) {
        return (
          <div style={{ padding: '2rem', background: 'var(--bg-card)', color: 'red', minHeight: '100vh', zIndex: 9999, position: 'relative' }}>
            <h2>React Crash!</h2>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{this.state.error?.toString()}</pre>
            <pre style={{ fontSize: '0.8rem', marginTop: '1rem', overflowX: 'auto' }}>{this.state.error?.stack}</pre>
          </div>
        );
      }
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'var(--bg-surface)',
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 440,
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: '8px 8px 0px 0px #000',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>
              Something Went Wrong
            </h2>
            <p style={{ color: '#333', marginBottom: 24, lineHeight: 1.5 }}>
              SmartApply hit an unexpected error. Reloading the page usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 28px',
                background: '#facc15',
                border: '1px solid var(--border-color)',
                boxShadow: '4px 4px 0px 0px #000',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
