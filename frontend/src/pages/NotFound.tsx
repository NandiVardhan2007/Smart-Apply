import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        background: 'var(--paper)',
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
        }}
      >
        <Compass size={28} />
      </div>
      <div className="stat-number" style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 8 }}>404</div>
      <h1 style={{ fontSize: 24, marginBottom: 10 }}>Page not found</h1>
      <p className="text-muted" style={{ fontSize: 14, marginBottom: 26, maxWidth: 380 }}>
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
}
