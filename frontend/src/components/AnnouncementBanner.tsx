import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Info, AlertTriangle, CheckCircle, AlertOctagon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnnouncementBanner() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiFetch<any>('/auth/public-settings')
      .then(res => {
        if (res.ok && res.data.announcement_active) {
          setActive(true);
          setMessage(res.data.announcement_message);
          setType(res.data.announcement_type || "info");
        }
      });
  }, []);

  if (!active || dismissed) return null;

  let bgColor = 'var(--primary-faint)';
  let textColor = 'var(--primary)';
  let Icon = Info;

  if (type === 'success') {
    bgColor = 'var(--success-faint)';
    textColor = 'var(--success)';
    Icon = CheckCircle;
  } else if (type === 'warning') {
    bgColor = 'var(--warning-faint)';
    textColor = 'var(--warning)';
    Icon = AlertTriangle;
  } else if (type === 'danger') {
    bgColor = 'var(--danger-faint)';
    textColor = 'var(--danger)';
    Icon = AlertOctagon;
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: -50, scale: 0.9, x: '-50%' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            background: bgColor,
            color: textColor,
            padding: '12px 24px',
            paddingRight: 48, // space for close button
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 9999,
            borderRadius: 999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
            border: `1px solid ${textColor}30`,
            maxWidth: '90vw',
            pointerEvents: 'auto'
          }}
        >
          <Icon size={20} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {message}
          </span>
          <button 
            onClick={() => setDismissed(true)}
            style={{ 
              background: 'transparent', border: 'none', color: textColor, 
              cursor: 'pointer', position: 'absolute', right: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 4, borderRadius: '50%', transition: 'background 0.2s'
            }}
            title="Dismiss"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
