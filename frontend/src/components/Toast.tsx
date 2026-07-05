import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration: number;
}

interface ToastContextType {
  showToast: (type: Toast['type'], message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: Toast['type'], message: string, duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 380,
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : Info;
  const colors = {
    success: { bg: 'var(--success-bg)', color: 'var(--success)' },
    error: { bg: 'var(--error-bg)', color: 'var(--error)' },
    info: { bg: 'var(--accent-soft)', color: 'var(--accent-secondary)' },
  };
  const c = colors[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        background: c.bg,
        border: '1px solid var(--border-color)',
        borderLeft: `8px solid ${c.color}`,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxShadow: '4px 4px 0px 0px #000',
      }}
    >
      <Icon size={18} style={{ color: c.color, flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1, fontSize: '0.9rem', lineHeight: 1.4 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{ color: 'var(--text-muted)', flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
