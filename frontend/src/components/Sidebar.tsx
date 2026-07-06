import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ScanSearch,
  MessageSquareText,
  Lightbulb,
  Video,
  User as UserIcon,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/dashboard.css';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    links: [{ to: '/dashboard', label: 'Home', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Resume',
    links: [
      { to: '/dashboard/resumes', label: 'My resumes', icon: FileText },
      { to: '/dashboard/ats-checker', label: 'ATS checker', icon: ScanSearch },
    ],
  },
  {
    title: 'Prepare',
    links: [
      { to: '/dashboard/ai-chatbot', label: 'AI career chat', icon: MessageSquareText },
      { to: '/dashboard/project-recommender', label: 'Project ideas', icon: Lightbulb },
      { to: '/dashboard/live-interview', label: 'Live interview', icon: Video },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();
  const initials = (user?.full_name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={onCloseMobile} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/small_logo.svg" alt="Smart Apply" />
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>
              {section.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={'end' in link ? link.end : false}
                  onClick={onCloseMobile}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="sidebar-link-content">
                    <link.icon size={17} />
                    {link.label}
                  </span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
            <NavLink to="/dashboard/profile" onClick={onCloseMobile} className="sidebar-link">
              <span className="sidebar-link-content">
                <UserIcon size={17} />
                Profile
              </span>
            </NavLink>
            <NavLink to="/dashboard/settings" onClick={onCloseMobile} className="sidebar-link">
              <span className="sidebar-link-content">
                <SettingsIcon size={17} />
                Settings
              </span>
            </NavLink>
          </div>
          <div className="sidebar-divider" />
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.profile_pic_url ? (
                <img
                  src={user.profile_pic_url}
                  alt=""
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                initials
              )}
            </div>
            <div className="sidebar-user-info" style={{ flex: 1 }}>
              <div className="name">{user?.full_name || 'Your account'}</div>
              <div className="email">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              aria-label="Log out"
              className="btn-icon"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)' }}
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
