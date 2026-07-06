import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import '../styles/dashboard.css';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="mobile-dashboard-nav">
          <img src="/small_logo.svg" alt="Smart Apply" />
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
          >
            <Menu size={22} />
          </button>
        </div>

        <main className="dashboard-main fade-in">{children}</main>
      </div>
    </div>
  );
}
