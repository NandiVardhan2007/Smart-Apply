import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-wide error boundary. Catches render/lifecycle errors in the tree below it
 * and shows a friendly fallback with a reload button instead of a blank white
 * screen. React error boundaries must be class components — there is no hook
 * equivalent for `componentDidCatch`.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the error to the console for debugging; a real deployment could
    // forward this to an error-reporting service here.
    console.error('Uncaught error caught by ErrorBoundary:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding: 24,
          textAlign: 'center',
          background: 'var(--surface)',
          color: 'var(--ink)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={32} />
        </div>
        <h1 style={{ margin: 0, fontSize: 24 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 440, color: 'var(--ink-faint)', fontSize: 14.5, lineHeight: 1.55 }}>
          An unexpected error occurred while rendering this page. Try reloading — if
          the problem persists, please contact support.
        </p>
        {this.state.error?.message && (
          <pre
            style={{
              maxWidth: 'min(560px, 90vw)',
              overflowX: 'auto',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-sunken)',
              color: 'var(--ink-faint)',
              fontSize: 12.5,
              fontFamily: 'var(--font-mono)',
              textAlign: 'left',
            }}
          >
            {this.state.error.message}
          </pre>
        )}
        <button className="btn btn-primary" onClick={this.handleReload}>
          Reload page
        </button>
      </div>
    );
  }
}
