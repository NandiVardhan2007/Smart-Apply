import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart3, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeSwitcher from './ThemeSwitcher';
import '../styles/dashboard.css';

export default function AdminSidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const { logout } = useAuth();

  return (
    <>
      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={onCloseMobile} />
      <aside className={`sidebar-container ${mobileOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="sidebar-header" style={{ padding: '24px 20px 16px' }}>
            <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 28, marginBottom: 4 }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Admin Console
            </div>
          </div>

          <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
            <div className="sidebar-section">
              <div className="sidebar-section-title">Navigation</div>
              <NavLink to="/dashboard/sysadmin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
                <LayoutDashboard size={18} /> Overview
              </NavLink>
            </div>
          </nav>

          <div style={{ padding: 20, borderTop: '1px solid var(--border)' }}>
            <ThemeSwitcher />
            
            <NavLink to="/dashboard" className="sidebar-link" onClick={onCloseMobile} style={{ marginTop: 8 }}>
              <ArrowLeft size={18} /> Back to App
            </NavLink>
            
            <button
              onClick={() => {
                logout();
                onCloseMobile();
              }}
              className="sidebar-link"
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--danger)', marginTop: 8 }}
            >
              <LogOut size={18} /> Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
