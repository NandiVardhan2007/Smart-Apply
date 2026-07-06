import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
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
          top: 20,
          right: 20,
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: 'min(380px, calc(100vw - 40px))',
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

function ToastCard({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const Icon = ICONS[toast.type];
  const tone =
    toast.type === 'success'
      ? { bg: 'var(--success-soft)', border: 'var(--success-border)', color: 'var(--success)' }
      : toast.type === 'error'
        ? { bg: 'var(--danger-soft)', border: 'var(--danger-border)', color: 'var(--danger)' }
        : { bg: 'var(--accent-soft)', border: 'var(--accent-soft-border)', color: 'var(--accent)' };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${tone.border}`,
        borderRadius: 'var(--radius)',
        padding: '13px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: tone.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon size={14} style={{ color: tone.color }} />
      </div>
      <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        style={{ color: 'var(--ink-faint)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2 }}
      >
        <X size={15} />
      </button>
    </motion.div>
  );
}
