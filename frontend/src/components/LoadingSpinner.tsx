import { motion, AnimatePresence } from 'framer-motion';

/* ────────────────────────────────────────────────────────
   SMART APPLY — Unified Loading Components
   Neo-Brutalist style: bold borders, yellow accent, hard shadows
   ──────────────────────────────────────────────────────── */

/* ─── Default export: small inline spinner (backwards compatible) ─── */
export default function LoadingSpinner({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <BrutalSpinner size={size} />
    </div>
  );
}

/* ─── Brutal spinning square ─── */
export function BrutalSpinner({ size = 40 }: { size?: number }) {
  return (
    <motion.div
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 14))}px solid #000`,
        borderTopColor: 'var(--accent)',
        borderRightColor: 'var(--accent)',
        background: 'transparent',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
    />
  );
}

/* ─── Three bouncing squares ─── */
export function BouncingDots({ color = '#000', size = 12 }: { color?: string; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: Math.round(size * 0.6), alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: size,
            height: size,
            background: i === 1 ? 'var(--accent)' : color,
            border: '2px solid #000',
          }}
          animate={{ y: [0, -(size * 1.2), 0] }}
          transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Variant config ─── */
const VARIANT_CONFIG = {
  analyze: {
    icon: '🔍',
    accentColor: 'var(--accent)',
    defaultTitle: 'AI IS ANALYZING...',
    defaultSubtitle: 'Our AI is carefully reviewing your resume',
    defaultSteps: ['Reading document structure', 'Extracting key information', 'Running ATS algorithms', 'Calculating score'],
  },
  generate: {
    icon: '⚡',
    accentColor: 'var(--accent-pink, #f472b6)',
    defaultTitle: 'GENERATING...',
    defaultSubtitle: 'Crafting personalized recommendations',
    defaultSteps: ['Analyzing your profile', 'Matching skills to market', 'Ranking opportunities', 'Finalizing results'],
  },
  extract: {
    icon: '📄',
    accentColor: 'var(--accent-blue, #60a5fa)',
    defaultTitle: 'EXTRACTING CODE...',
    defaultSubtitle: 'Using NVIDIA Vision to parse your resume',
    defaultSteps: ['Uploading document', 'Running vision model', 'Parsing structure', 'Formatting output'],
  },
  default: {
    icon: '🤖',
    accentColor: 'var(--accent)',
    defaultTitle: 'AI IS WORKING...',
    defaultSubtitle: 'Please wait while we process your request',
    defaultSteps: ['Initializing', 'Processing', 'Finalizing', 'Almost done'],
  },
} as const;

type LoaderVariant = keyof typeof VARIANT_CONFIG;

/* ─── Full-page AI processing loader ─── */
interface PageLoaderProps {
  show: boolean;
  title?: string;
  subtitle?: string;
  steps?: string[];
  variant?: LoaderVariant;
}

export function PageLoader({ show, title, subtitle, steps, variant = 'default' }: PageLoaderProps) {
  const cfg = VARIANT_CONFIG[variant];
  const finalTitle = title ?? cfg.defaultTitle;
  const finalSubtitle = subtitle ?? cfg.defaultSubtitle;
  const finalSteps = steps ?? cfg.defaultSteps;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="page-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(244,244,240,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              background: '#fff',
              border: '4px solid #000',
              boxShadow: '12px 12px 0px #000',
              padding: '48px 56px',
              maxWidth: 480,
              width: '90%',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            {/* Corner accents */}
            <div style={{ position: 'absolute', top: -4, left: -4, width: 32, height: 32, background: cfg.accentColor, border: '4px solid #000' }} />
            <div style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, background: cfg.accentColor, border: '4px solid #000' }} />

            {/* Icon */}
            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 56, lineHeight: 1, marginBottom: 24 }}
            >
              {cfg.icon}
            </motion.div>

            {/* Title */}
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.6rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
              color: '#000',
            }}>
              {finalTitle}
            </h2>

            <p style={{ color: '#555', fontWeight: 600, marginBottom: 32, fontSize: '0.95rem' }}>
              {finalSubtitle}
            </p>

            {/* Animated progress bar */}
            <div style={{
              height: 8,
              background: '#f4f4f0',
              border: '2px solid #000',
              marginBottom: 32,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <motion.div
                style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: cfg.accentColor, width: '40%' }}
                animate={{ x: ['-100%', '350%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Steps checklist */}
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {finalSteps.map((step, i) => (
                <StepItem key={i} index={i} label={step} totalSteps={finalSteps.length} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StepItem({ index, label, totalSteps }: { index: number; label: string; totalSteps: number }) {
  const cycleTime = 1.6;
  const totalDuration = totalSteps * cycleTime;

  return (
    <motion.div
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.12, duration: 0.3 }}
    >
      <motion.div
        style={{
          width: 20,
          height: 20,
          border: '2px solid #000',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 900,
        }}
        animate={{ background: ['#fff', 'var(--accent)', '#fff'] }}
        transition={{ duration: totalDuration, repeat: Infinity, delay: index * cycleTime, ease: 'easeInOut' }}
      >
        <motion.span
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: totalDuration, repeat: Infinity, delay: index * cycleTime }}
        >
          ✓
        </motion.span>
      </motion.div>
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </motion.div>
  );
}

/* ─── Inline loading card ─── */
interface InlineLoaderProps {
  title?: string;
  subtitle?: string;
  variant?: LoaderVariant;
}

export function InlineLoader({ title, subtitle, variant = 'default' }: InlineLoaderProps) {
  const cfg = VARIANT_CONFIG[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 32px',
        gap: 20,
        background: '#fff',
        border: '4px solid #000',
        boxShadow: '8px 8px 0px #000',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Scanning stripe */}
      <motion.div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: cfg.accentColor, transformOrigin: 'left' }}
        animate={{ scaleX: [0, 1, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
      />


      {/* Icon */}
      <motion.div
        style={{ fontSize: 48, lineHeight: 1 }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {cfg.icon}
      </motion.div>

      <BrutalSpinner size={40} />

      <div>
        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.2rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
          color: '#000',
        }}>
          {title ?? cfg.defaultTitle}
        </h3>
        {subtitle && (
          <p style={{ color: '#666', fontWeight: 600, fontSize: '0.9rem' }}>
            {subtitle}
          </p>
        )}
      </div>

      <BouncingDots />
    </motion.div>
  );
}

/* ─── Skeleton card with shimmer ─── */
export function SkeletonCard({ height = 160 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        background: '#f4f4f0',
        border: '3px solid #000',
        boxShadow: '4px 4px 0px #000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '60%',
          background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.35), transparent)',
        }}
        animate={{ x: ['-60%', '250%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <motion.div
          style={{ height: 16, background: '#ddd', border: '1px solid #bbb', width: '70%' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <motion.div
          style={{ height: 12, background: '#e8e8e8', border: '1px solid #ccc', width: '90%' }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 0.2 }}
        />
        <motion.div
          style={{ height: 12, background: '#e8e8e8', border: '1px solid #ccc', width: '55%' }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </div>
  );
}

/* ─── Button spinner (tiny, inline) ─── */
export function ButtonSpinner({ size = 18 }: { size?: number }) {
  return (
    <motion.div
      style={{
        width: size,
        height: size,
        border: `2px solid rgba(0,0,0,0.25)`,
        borderTopColor: '#000',
        display: 'inline-block',
        flexShrink: 0,
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
    />
  );
}
