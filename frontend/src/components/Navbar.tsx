import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Clock() {
  const [time, setTime] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const now = new Date();
      let hours = now.getHours();
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const h = String(hours).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s} ${period}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 900, opacity: 0 }}>00:00:00 AM</span>;

  return (
    <span style={{ 
      fontFamily: 'var(--font-mono)', 
      fontSize: '0.875rem', 
      fontWeight: 900, 
      letterSpacing: '0.1em',
      color: 'var(--text-primary)',
      transition: 'all 0.3s'
    }}
    className="clock-hover"
    >
      {time}
    </span>
  );
}

const HOME_SECTIONS = [
  { label: 'Features', href: '/#features' },
  { label: 'Stats', href: '/#stats' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Don't show navbar on dashboard pages
  if (location.pathname.startsWith('/dashboard')) return null;

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 0.3s',
        background: isScrolled ? '#ffffff' : 'transparent',
        borderBottom: isScrolled ? 'var(--border-brutal)' : '3px solid transparent',
        boxShadow: isScrolled ? 'var(--shadow-brutal)' : 'none',
      }}
    >
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '0 24px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.svg" alt="Smart Apply Logo" style={{ height: '64px', objectFit: 'contain' }} />
        </Link>

        {/* Desktop links */}
        <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {HOME_SECTIONS.map((l) => (
            <a 
              key={l.href} 
              href={l.href}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {l.label}
            </a>
          ))}
          {isAuthenticated ? (
            <Link 
              to="/dashboard" 
              className="btn btn-primary btn-sm"
            >
              Dashboard
            </Link>
          ) : (
            <Link 
              to="/login" 
              className="btn btn-primary btn-sm"
            >
              Log In
            </Link>
          )}
        </nav>

        {/* Right section with Clock */}
        <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Clock />
        </div>

        {/* Mobile controls */}
        <div className="nav-mobile-btn" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ color: 'var(--text-primary)' }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', background: '#fff', borderBottom: 'var(--border-brutal)', boxShadow: 'var(--shadow-brutal)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 24px', gap: 16 }}>
              {HOME_SECTIONS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}
                >
                  {l.label}
                </a>
              ))}
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)', marginTop: 8 }}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)', marginTop: 8 }}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
        .clock-hover:hover {
          letter-spacing: 0.2em;
        }
      `}</style>
    </motion.header>
  );
}
