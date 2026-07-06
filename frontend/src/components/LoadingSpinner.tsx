import { Loader2 } from 'lucide-react';

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
  if (!show) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(250, 250, 249, 0.92)',
        backdropFilter: 'blur(2px)',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <LoadingSpinner size={36} />
      <div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

/** Shimmering placeholder block for cards that are still loading. */
export function SkeletonCard({ height = 160 }: { height?: number }) {
  return <div className="skeleton" style={{ height, width: '100%' }} />;
}
