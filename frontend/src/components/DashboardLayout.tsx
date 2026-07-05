import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import '../styles/dashboard.css';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  
  // If the last part is a MongoDB ObjectId (24 hex chars), use the preceding part for the title
  let currentPage = pathParts[pathParts.length - 1];
  const isBase64Id = /^[A-Za-z0-9+/]+=*$/.test(currentPage) && currentPage.length > 20;

  if (/^[0-9a-fA-F]{24}$/.test(currentPage) && pathParts.length > 1) {
    currentPage = pathParts[pathParts.length - 2];
  } else if (isBase64Id && pathParts.length > 1) {
    currentPage = pathParts[pathParts.length - 2];
  } else if (currentPage.startsWith('interview-') && pathParts.length > 1) {
    currentPage = pathParts[pathParts.length - 2];
  }
  
  const pageTitle = currentPage
    ? currentPage.split('-').map(word => word.toUpperCase()).join(' ')
    : 'DASHBOARD';

  return (
    <div className="dashboard-layout relative min-h-screen">
      <div className="bg-dots" style={{ zIndex: 0 }} />
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile Navbar */}
      <div className="mobile-dashboard-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.svg" alt="Smart Apply Logo" style={{ height: '32px', objectFit: 'contain' }} />
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '6px', boxShadow: 'var(--shadow-sm)' }}
        >
          {sidebarOpen ? <X size={22} className="text-text-primary" /> : <Menu size={22} className="text-text-primary" />}
        </button>
      </div>

      <main className="dashboard-main relative z-10">
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <motion.div 
            className="text-massive"
            style={{ 
              fontSize: 'clamp(2rem, 4vw, 4rem)', 
              marginBottom: '32px', 
              letterSpacing: '-0.05em', 
              lineHeight: 1,
              color: 'var(--text-primary)'
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            key={`title-${pageTitle}`}
          >
            {pageTitle}.
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
