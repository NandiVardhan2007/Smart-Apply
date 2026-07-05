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
  { label: 'Testimonials', href: '/#testimonials' },
  { label: 'Pricing', href: '/#pricing' },
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
        background: (isScrolled || mobileOpen) ? 'rgba(10, 10, 10, 0.75)' : 'transparent',
        backdropFilter: (isScrolled || mobileOpen) ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: (isScrolled || mobileOpen) ? 'blur(20px)' : 'none',
        borderBottom: (isScrolled || mobileOpen) ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent',
        boxShadow: (isScrolled || mobileOpen) ? '0 4px 32px rgba(0,0,0,0.4)' : 'none',
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
        <nav className="nav-desktop" style={{ alignItems: 'center', gap: 32 }}>
          {HOME_SECTIONS.map((l) => (
            <a 
              key={l.href} 
              href={l.href}
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                transition: 'color 0.2s, text-shadow 0.2s'
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
        <div className="nav-desktop" style={{ alignItems: 'center', gap: 16 }}>
          <Clock />
        </div>

        {/* Mobile controls */}
        <div className="nav-mobile-btn" style={{ alignItems: 'center', gap: 8 }}>
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
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: -1, // Behind the nav content, but inside the fixed header context
                height: '100vh'
              }}
            />
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', background: 'rgba(10, 10, 10, 0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', padding: '24px', gap: 12 }}>
              {HOME_SECTIONS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="mobile-nav-link"
                >
                  {l.label}
                </a>
              ))}
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="mobile-nav-link mobile-nav-primary"
                >
                  Dashboard
                </Link>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="mobile-nav-link"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="mobile-nav-link mobile-nav-primary"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .nav-desktop { display: flex; }
        .nav-mobile-btn { display: none; }
        .mobile-nav-link {
          display: block;
          padding: 12px 16px;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: var(--radius);
          text-align: center;
          text-decoration: none;
          transition: all 0.2s;
        }
        .mobile-nav-link:active {
          background: rgba(255, 255, 255, 0.08);
        }
        .mobile-nav-primary {
          background: linear-gradient(135deg, var(--accent-start) 0%, var(--accent) 100%);
          color: var(--primary-foreground);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: var(--shadow-glow);
        }
        @media (max-width: 768px) {
          .nav-desktop { display: none; }
          .nav-mobile-btn { display: flex; }
        }
        .clock-hover:hover {
          letter-spacing: 0.2em;
        }
      `}</style>
    </motion.header>
  );
}
