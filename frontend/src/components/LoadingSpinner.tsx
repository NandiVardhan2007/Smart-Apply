import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** A plain centered spinner — used for full-page or section-level loading. */
export default function LoadingSpinner({ size = 32 }: { size?: number }) {
  return <Loader2 size={size} className="spin" style={{ color: 'var(--accent)' }} />;
}

/** Small spinner meant to sit inline inside a button, replacing its label. */
export function ButtonSpinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="spin" />;
}

/** Centered loader with an optional title/subtitle, for a section that's still fetching. */
export function InlineLoader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 14,
        color: 'var(--ink-soft)',
      }}
    >
      <LoadingSpinner size={30} />
      <div>
        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

/** Full-viewport overlay loader for heavier async operations (extraction, compilation). */
export function PageLoader({ show, title, subtitle }: { show: boolean; title: string; subtitle?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(250, 250, 249, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--accent-soft-border)',
              borderRadius: '24px',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              textAlign: 'center',
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '3px solid var(--accent-soft)',
                  borderTopColor: 'var(--accent)',
                }}
              />
              <Loader2 size={24} style={{ color: 'var(--accent)' }} className="spin" />
            </div>
            
            <div>
              <h3 style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', margin: '0 0 6px 0' }}>{title}</h3>
              {subtitle && (
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>{subtitle}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Shimmering placeholder block for cards that are still loading. */
export function SkeletonCard({ height = 160 }: { height?: number }) {
  return <div className="skeleton" style={{ height, width: '100%' }} />;
}
