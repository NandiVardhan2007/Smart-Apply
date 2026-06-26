import { NavLink, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  FileSearch,
  MessageSquare,
  Mic,
  LogOut,
  X,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/dashboard.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItemsProfile = [
  { to: '/dashboard/profile', icon: User, label: 'Profile', color: '#2F8FFF' },
  { to: '/dashboard/resumes', icon: FileText, label: 'My Resumes', color: '#FF4757' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings', color: '#636e72' },
];

const navItemsAi = [
  { to: '/dashboard/ats-checker', icon: FileSearch, label: 'ATS Checker', color: '#2ED573' },
  { to: '/dashboard/ai-chatbot', icon: MessageSquare, label: 'AI Chatbot', color: '#9B59B6' },
  { to: '/dashboard/live-interview', icon: Mic, label: 'Live Interview', color: '#FF9F43' },
  { to: '/dashboard/project-recommender', icon: Lightbulb, label: 'Project Finder', color: '#F1C40F' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const initials = (user?.full_name || 'Smart Apply')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sidebar-overlay visible"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ display: 'block' }}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={`sidebar ${isOpen ? 'open' : ''}`}
        initial={false}
        animate={isOpen ? { x: 0 } : undefined}
      >
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative', height: '80px' }}>
            <img src="/logo.svg" alt="Smart Apply Logo" className="expanded-logo" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.35)', transformOrigin: 'center center' }} />
            <img src="/small_logo.svg" alt="Smart Apply Logo Small" className="collapsed-logo" style={{ width: '48px', height: '48px', objectFit: 'contain', transform: 'scale(1.6)', transformOrigin: 'center center' }} />
            <button
              onClick={onClose}
              className="mobile-close-btn"
              style={{ display: 'none', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-title">Profile & Setup</span>
          {navItemsProfile.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              <div className="sidebar-link-content">
                <item.icon size={20} className="icon" style={{ color: item.color }} />
                <span>{item.label}</span>
              </div>
            </NavLink>
          ))}

          <div className="sidebar-divider"></div>

          <span className="sidebar-section-title">AI Tools</span>
          {navItemsAi.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              <div className="sidebar-link-content">
                <item.icon size={20} className="icon" style={{ color: item.color }} />
                <span>{item.label}</span>
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/dashboard/profile" className="sidebar-user" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <div className="sidebar-avatar" style={{ overflow: 'hidden' }}>
              {user?.profile_pic_url ? (
                <img src={user.profile_pic_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initials
              )}
            </div>
            <div className="sidebar-user-info">
              <div className="name">{user?.full_name || 'User'}</div>
              <div className="email" style={{ color: '#000', fontWeight: 600 }}>{user?.email || ''}</div>
            </div>
          </Link>
          <button
            className="sidebar-link"
            onClick={logout}
            style={{ marginTop: 8, width: '100%', background: 'var(--error)' }}
          >
            <div className="sidebar-link-content">
              <LogOut size={20} className="icon" />
              <span>Log Out</span>
            </div>
          </button>
        </div>

        <style>{`
          @media (max-width: 1024px) {
            .mobile-close-btn { display: flex !important; }
          }
        `}</style>
      </motion.aside>
    </>
  );
}
