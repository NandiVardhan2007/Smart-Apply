import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import ThemeSwitcher from './ThemeSwitcher';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '/docs', label: 'Documentation', isRoute: true },
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
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      style={{
        position: 'fixed',
        top: 12,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '0 16px',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.12)',
          transition: 'all 300ms ease',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--minutrix-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 18, filter: 'brightness(0) invert(1)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#0b0e17' }}>
            Smart<span style={{ color: '#4f6df5' }}>Apply</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="desktop-nav-links">
          <a href="#features" style={{ fontSize: 14.5, fontWeight: 500, color: '#1a1a2e', textDecoration: 'none' }}>
            Services ▾
          </a>
          <a href="#ai-agents" style={{ fontSize: 14.5, fontWeight: 500, color: '#1a1a2e', textDecoration: 'none' }}>
            AI Agents
          </a>
          <a href="#how-it-works" style={{ fontSize: 14.5, fontWeight: 500, color: '#1a1a2e', textDecoration: 'none' }}>
            Learning ▾
          </a>
          <Link to="/docs" style={{ fontSize: 14.5, fontWeight: 500, color: '#1a1a2e', textDecoration: 'none' }}>
            Community
          </Link>
          <a href="#pricing" style={{ fontSize: 14.5, fontWeight: 500, color: '#1a1a2e', textDecoration: 'none' }}>
            Pricing
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="desktop-nav-actions">
          {isAuthenticated ? (
            <button className="btn btn-sm" onClick={() => navigate('/dashboard')} style={{ background: '#0b0e17', color: '#ffffff', borderRadius: 999, padding: '9px 20px', fontWeight: 600 }}>
              Go to Dashboard
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')} style={{ color: '#1a1a2e', fontWeight: 600, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '7px 16px' }}>
                Sign In
              </button>
              <button className="btn btn-sm" onClick={() => navigate('/signup')} style={{ background: '#0b0e17', color: '#ffffff', borderRadius: 999, padding: '9px 22px', fontWeight: 600 }}>
                Get Started
              </button>
            </>
          )}
        </div>

        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', color: '#0b0e17' }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(3, 3, 5, 0.95)',
              backdropFilter: 'blur(16px)',
              padding: '16px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflow: 'hidden'
            }}
          >
            {LINKS.map((l) =>
              l.isRoute ? (
                <Link key={l.href} to={l.href} onClick={() => setMobileOpen(false)} style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {l.label}
                </Link>
              ) : (
                <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {l.label}
                </a>
              )
            )}
            <div style={{ paddingBottom: 10 }}>
               <ThemeSwitcher />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isAuthenticated ? (
                <button className="btn btn-primary w-full" onClick={() => navigate('/dashboard')}>
                  Go to dashboard
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary w-full" onClick={() => navigate('/login')}>
                    Log in
                  </button>
                  <button className="btn btn-primary w-full" onClick={() => navigate('/signup')}>
                    Get started
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 800px) {
          .desktop-nav-links, .desktop-nav-actions { display: none !important; }
          .mobile-nav-toggle { display: inline-flex !important; }
        }
        .nav-link-hover {
          transition: color var(--transition);
        }
        .nav-link-hover:hover { color: var(--text-primary) !important; }
      `}</style>
    </motion.header>
  );
}
