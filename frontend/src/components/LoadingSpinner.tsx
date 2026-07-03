import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

/* ===========================================================
   SMART APPLY — Premium Loading Components  v2
   Neo-Brutalist - Yellow accent - Hard shadows - Rich motion
   =========================================================== */

/* --- Default export (backwards compatible) --------------- */
export default function LoadingSpinner({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <OrbitSpinner size={size} />
    </div>
  );
}

/* ===========================================================
   ORBIT SPINNER
   A square with two orbiting dots — premium feel
   =========================================================== */
export function OrbitSpinner({ size = 44 }: { size?: number }) {
  const r = size / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Static circle */}
      <div style={{
        position: 'absolute', inset: size * 0.2,
        borderRadius: '50%',
        border: '3px solid #000',
        background: 'var(--accent)',
      }} />
      {/* Orbiting ring */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#000',
          borderRightColor: '#000',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {/* Counter-orbit */}
      <motion.div
        style={{
          position: 'absolute', inset: size * 0.1,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderBottomColor: 'var(--accent)',
          borderLeftColor: 'var(--accent)',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

/* --- kept as BrutalSpinner alias for backwards compat --- */
export function BrutalSpinner({ size = 40 }: { size?: number }) {
  return <OrbitSpinner size={size} />;
}

/* ===========================================================
   BUTTON SPINNER  — square, crisp, minimal
   =========================================================== */
export function ButtonSpinner({ size = 16 }: { size?: number }) {
  return (
    <motion.div
      style={{
        width: size, height: size, flexShrink: 0, display: 'inline-block',
        borderRadius: '50%',
        border: '2px solid rgba(0,0,0,0.2)',
        borderTopColor: '#000',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.65, repeat: Infinity, ease: 'linear' }}
    />
  );
}

/* ===========================================================
   BOUNCING DOTS  — 3 squares with staggered bounce
   =========================================================== */
export function BouncingDots({ size = 10 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: size * 2.5 }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: size, height: size,
            background: i === 1 ? 'var(--accent)' : '#000',
            border: '2px solid #000',
          }}
          animate={{ scaleY: [1, 2.2, 1], y: [0, -(size * 0.6), 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ===========================================================
   VARIANT CONFIG
   =========================================================== */
const VARIANT_CONFIG = {
  analyze: {
    label: 'ANALYZING',
    accentColor: '#facc15',
    accentBg: '#fef9c3',
    bar1: '#facc15',
    bar2: '#fbbf24',
    steps: [
      'Parsing document structure',
      'Extracting keywords & skills',
      'Running ATS compatibility checks',
      'Scoring against job description',
    ],
    messages: [
      'Reading your resume carefully...',
      'Matching keywords to job requirements...',
      'Detecting ATS-friendly formatting...',
      'Calculating compatibility score...',
    ],
  },
  generate: {
    label: 'GENERATING',
    accentColor: '#f472b6',
    accentBg: '#fce7f3',
    bar1: '#f472b6',
    bar2: '#ec4899',
    steps: [
      'Analyzing your skill profile',
      'Searching project database',
      'Ranking by relevance & impact',
      'Compiling final recommendations',
    ],
    messages: [
      'Scanning your skill set...',
      'Finding perfect project matches...',
      'Ranking by market demand...',
      'Finalizing your roadmap...',
    ],
  },
  extract: {
    label: 'EXTRACTING',
    accentColor: '#60a5fa',
    accentBg: '#dbeafe',
    bar1: '#60a5fa',
    bar2: '#3b82f6',
    steps: [
      'Uploading document securely',
      'Running NVIDIA Vision AI',
      'Parsing layout & structure',
      'Formatting editable output',
    ],
    messages: [
      'Uploading your resume...',
      'Vision AI is reading the file...',
      'Extracting text & formatting...',
      'Preparing the editor...',
    ],
  },
  default: {
    label: 'PROCESSING',
    accentColor: '#facc15',
    accentBg: '#fef9c3',
    bar1: '#facc15',
    bar2: '#fbbf24',
    steps: ['Initializing AI model', 'Processing request', 'Generating output', 'Finalizing result'],
    messages: [
      'Starting AI engine...',
      'Processing your request...',
      'Generating smart output...',
      'Almost there...',
    ],
  },
} as const;

type LoaderVariant = keyof typeof VARIANT_CONFIG;

/* --- Typewriter cycling hook ------------------------------- */
function useCyclingText(messages: readonly string[], intervalMs = 2200) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((p) => (p + 1) % messages.length), intervalMs);
    return () => clearInterval(t);
  }, [messages, intervalMs]);
  return messages[idx];
}

/* ===========================================================
   PAGE LOADER  — full-screen premium overlay
   =========================================================== */
interface PageLoaderProps {
  show: boolean;
  title?: string;
  subtitle?: string;
  steps?: string[];
  variant?: LoaderVariant;
}

export function PageLoader({ show, title, subtitle, steps, variant = 'default' }: PageLoaderProps) {
  const cfg = VARIANT_CONFIG[variant];
  const cyclingMsg = useCyclingText(cfg.messages);
  const finalTitle = title ?? cfg.label;
  const finalSteps = steps ?? cfg.steps;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="page-loader-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(244,244,240,0.96)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Background dot-grid */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: 'radial-gradient(circle, #00000018 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'relative', zIndex: 1,
              background: '#ffffff',
              border: '4px solid #000',
              boxShadow: '16px 16px 0px #000',
              width: '90%', maxWidth: 500,
              overflow: 'hidden',
            }}
          >
            {/* Top accent bar */}
            <div style={{ height: 8, background: '#000', position: 'relative', overflow: 'hidden' }}>
              <motion.div
                style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(90deg, transparent 0%, ${cfg.accentColor} 40%, ${cfg.bar2} 60%, transparent 100%)`,
                  width: '50%',
                }}
                animate={{ x: ['-50%', '250%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <div style={{ padding: '40px 48px 48px' }}>
              {/* Header row: spinner + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                <OrbitSpinner size={52} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{
                    display: 'inline-block',
                    background: cfg.accentColor,
                    border: '3px solid #000',
                    padding: '3px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}>
                    {finalTitle}
                  </div>
                  {/* Cycling message with AnimatePresence */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={cyclingMsg}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: '#111',
                        margin: 0,
                      }}
                    >
                      {subtitle ?? cyclingMsg}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* Progress track */}
              <div style={{
                height: 10, background: '#f4f4f0',
                border: '2px solid #000',
                marginBottom: 32, position: 'relative', overflow: 'hidden',
              }}>
                {/* Fill */}
                <motion.div
                  style={{
                    position: 'absolute', top: 0, left: 0, height: '100%',
                    background: cfg.accentColor,
                    width: '35%',
                  }}
                  animate={{ x: ['-35%', '320%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Glint */}
                <motion.div
                  style={{
                    position: 'absolute', top: 0, height: '100%', width: 8,
                    background: 'rgba(255,255,255,0.7)',
                  }}
                  animate={{ x: ['-10px', '510px'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
                />
              </div>

              {/* Step list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {finalSteps.map((step, i) => (
                  <PremiumStepItem key={i} index={i} label={step} total={finalSteps.length} accentColor={cfg.accentColor} />
                ))}
              </div>
            </div>

            {/* Bottom corner tags */}
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              background: '#000', color: cfg.accentColor,
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
              fontWeight: 900, padding: '4px 10px',
              letterSpacing: '0.1em',
            }}>
              SMART APPLY AI
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* --- Premium step item with real sequential highlight ---- */
function PremiumStepItem({ index, label, total, accentColor }: {
  index: number; label: string; total: number; accentColor: string;
}) {
  const stepDuration = 2000; // ms per step
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (index !== 0) return; // only root drives the counter
    const t = setInterval(() => setActiveStep((p) => (p + 1) % total), stepDuration);
    return () => clearInterval(t);
  }, [total]);

  // Each item just needs to know its own state relative to activeStep
  // But since we can't share state here easily, use a time-based approach
  const [phase, setPhase] = useState<'pending' | 'active' | 'done'>('pending');

  useEffect(() => {
    const stepMs = stepDuration;
    const delay = index * stepMs;
    const cycleDuration = total * stepMs;

    function tick() {
      const now = Date.now();
      const pos = (now % cycleDuration);
      if (pos >= delay && pos < delay + stepMs) {
        setPhase('active');
      } else if (pos >= delay + stepMs || pos < delay) {
        setPhase(pos > delay + stepMs ? 'done' : 'pending');
      }
    }

    tick();
    const t = setInterval(tick, 80);
    return () => clearInterval(t);
  }, [index, total]);

  return (
    <motion.div
      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: 'easeOut' }}
    >
      {/* Status box */}
      <motion.div
        animate={{
          background: phase === 'active' ? accentColor : phase === 'done' ? '#000' : '#f4f4f0',
          borderColor: phase === 'pending' ? '#ccc' : '#000',
          scale: phase === 'active' ? 1.1 : 1,
        }}
        transition={{ duration: 0.2 }}
        style={{
          width: 22, height: 22,
          border: '2px solid #ccc',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {phase === 'done' && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{ color: '#facc15', fontSize: 12, fontWeight: 900, lineHeight: 1 }}
          >
            âœ“
          </motion.span>
        )}
        {phase === 'active' && (
          <motion.div
            style={{ width: 6, height: 6, background: '#000' }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Label */}
      <motion.span
        animate={{
          color: phase === 'active' ? '#000' : phase === 'done' ? '#666' : '#aaa',
          fontWeight: phase === 'active' ? 800 : 600,
        }}
        style={{
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}
      </motion.span>

      {/* Active pulse line */}
      {phase === 'active' && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          style={{
            flex: 1, height: 2,
            background: accentColor,
            transformOrigin: 'left',
            border: '1px solid #000',
          }}
        />
      )}
    </motion.div>
  );
}

/* ===========================================================
   INLINE LOADER  — card-level, dramatic scan effect
   =========================================================== */
interface InlineLoaderProps {
  title?: string;
  subtitle?: string;
  variant?: LoaderVariant;
}

export function InlineLoader({ title, subtitle, variant = 'default' }: InlineLoaderProps) {
  const cfg = VARIANT_CONFIG[variant];
  const cyclingMsg = useCyclingText(cfg.messages, 1800);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'relative', overflow: 'hidden',
        background: '#fff',
        border: '4px solid #000',
        boxShadow: '8px 8px 0px #000',
        padding: '52px 40px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 24, textAlign: 'center',
      }}
    >
      {/* Diagonal scan beam */}
      <motion.div
        style={{
          position: 'absolute', top: '-100%', left: '-20%',
          width: '40%', height: '300%',
          background: `linear-gradient(105deg, transparent 30%, ${cfg.accentColor}55 50%, transparent 70%)`,
          pointerEvents: 'none',
        }}
        animate={{ x: ['0%', '400%'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
      />

      {/* Top accent stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 5,
        background: '#000', overflow: 'hidden',
      }}>
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, transparent, ${cfg.accentColor}, transparent)`,
            width: '40%',
          }}
          animate={{ x: ['-40%', '300%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Main spinner */}
      <div style={{ position: 'relative' }}>
        <OrbitSpinner size={64} />
        {/* Pulse ring */}
        <motion.div
          style={{
            position: 'absolute',
            inset: -10,
            border: `3px solid ${cfg.accentColor}`,
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0.8, 0, 0.8], scale: [1, 1.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>

      {/* Badge */}
      <div style={{
        background: cfg.accentColor,
        border: '3px solid #000',
        padding: '4px 16px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        fontWeight: 900,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}>
        {cfg.label}
      </div>

      {/* Cycling text */}
      <div style={{ minHeight: 48 }}>
        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.15rem', fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 6, color: '#000',
        }}>
          {title ?? cfg.label}
        </h3>
        <AnimatePresence mode="wait">
          <motion.p
            key={cyclingMsg}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
            style={{ color: '#555', fontWeight: 600, fontSize: '0.88rem', margin: 0 }}
          >
            {subtitle ?? cyclingMsg}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Bouncing dots */}
      <BouncingDots size={9} />

      {/* Corner decoration */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 0, height: 0,
        borderLeft: '32px solid transparent',
        borderBottom: `32px solid ${cfg.accentColor}`,
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 0, height: 0,
        borderRight: '32px solid transparent',
        borderTop: '32px solid #000',
      }} />
    </motion.div>
  );
}

/* ===========================================================
   SKELETON CARD  — diagonal shimmer + structured placeholders
   =========================================================== */
export function SkeletonCard({ height = 160 }: { height?: number }) {
  return (
    <div style={{
      height, position: 'relative', overflow: 'hidden',
      background: '#f8f8f4',
      border: '3px solid #000',
      boxShadow: '4px 4px 0px #000',
    }}>
      {/* Diagonal shimmer */}
      <motion.div
        style={{
          position: 'absolute', top: '-150%', left: '-50%',
          width: '35%', height: '400%',
          background: 'linear-gradient(105deg, transparent 30%, rgba(250,204,21,0.45) 50%, transparent 70%)',
          pointerEvents: 'none',
        }}
        animate={{ x: ['0%', '500%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', repeatDelay: 0.3 }}
      />

      {/* Top accent line */}
      <div style={{ height: 4, background: '#facc15', borderBottom: '2px solid #000' }} />

      {/* Content skeleton */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* Title bar */}
        <motion.div
          style={{ height: 14, background: '#d4d4d4', width: '65%', border: '1px solid #bbb' }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Subtitle */}
        <motion.div
          style={{ height: 10, background: '#e5e5e5', width: '88%', border: '1px solid #ccc' }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 0.15 }}
        />
        <motion.div
          style={{ height: 10, background: '#e5e5e5', width: '50%', border: '1px solid #ccc' }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
        />
        {/* Tag pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {[40, 56, 32].map((w, i) => (
            <motion.div
              key={i}
              style={{ height: 18, width: w, background: '#d4d4d4', border: '1px solid #bbb' }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
