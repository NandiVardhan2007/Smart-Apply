import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
];

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: scrolled ? 'var(--surface)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div
        className="container"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 28 }} />
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="desktop-nav-links">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)' }}
              className="nav-link-hover"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="desktop-nav-actions">
          {isAuthenticated ? (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>
                Log in
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/signup')}>
                Get started
              </button>
            </>
          )}
        </div>

        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} style={{ fontSize: 14.5, fontWeight: 500 }}>
              {l.label}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {isAuthenticated ? (
              <button className="btn btn-primary btn-block" onClick={() => navigate('/dashboard')}>
                Go to dashboard
              </button>
            ) : (
              <>
                <button className="btn btn-secondary btn-block" onClick={() => navigate('/login')}>
                  Log in
                </button>
                <button className="btn btn-primary btn-block" onClick={() => navigate('/signup')}>
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 800px) {
          .desktop-nav-links, .desktop-nav-actions { display: none !important; }
          .mobile-nav-toggle { display: inline-flex !important; }
        }
        .nav-link-hover:hover { color: var(--ink) !important; }
      `}</style>
    </header>
  );
}
