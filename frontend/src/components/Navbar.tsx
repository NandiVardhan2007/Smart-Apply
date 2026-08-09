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
        className={scrolled ? 'glass-nav' : ''}
        style={{
          maxWidth: 1140,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderRadius: 999,
          background: scrolled ? 'rgba(7, 8, 12, 0.88)' : 'rgba(15, 17, 26, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          transition: 'all 300ms ease',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
          }}>
            <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 18, filter: 'brightness(0) invert(1)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
            Smart<span style={{ color: '#818cf8' }}>Apply</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="desktop-nav-links">
          {LINKS.map((l) =>
            l.isRoute ? (
              <Link
                key={l.href}
                to={l.href}
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)', textDecoration: 'none' }}
                className="nav-link-hover"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)', textDecoration: 'none' }}
                className="nav-link-hover"
              >
                {l.label}
              </a>
            )
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} className="desktop-nav-actions">
          <ThemeSwitcher variant="compact" />
          {isAuthenticated ? (
            <button className="btn btn-glow btn-sm" onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')} style={{ color: '#cbd5e1' }}>
                Log in
              </button>
              <button className="btn btn-glow btn-sm" onClick={() => navigate('/signup')}>
                Get started free
              </button>
            </>
          )}
        </div>

        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{ display: 'none', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
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
