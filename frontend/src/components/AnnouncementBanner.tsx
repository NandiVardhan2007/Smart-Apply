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
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          style={{
            background: bgColor,
            color: textColor,
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            position: 'relative',
            zIndex: 1000,
            borderBottom: `1px solid ${textColor}`
          }}
        >
          <Icon size={20} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{message}</span>
          <button 
            onClick={() => setDismissed(true)}
            style={{ 
              background: 'transparent', border: 'none', color: textColor, 
              cursor: 'pointer', position: 'absolute', right: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="Dismiss"
          >
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
