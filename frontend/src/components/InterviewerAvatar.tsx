import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface InterviewerAvatarProps {
  state: AvatarState;
  /** Persona key — maps to a specific character image. */
  persona?: string;
  /** 0–1 RMS level used for lip-sync amplitude while speaking. */
  rmsLevel?: number;
  /** CSS width/height for the avatar container. */
  size?: number;
}

/* ────────────────────────────────────────────────────────────
 * Persona → Character mapping
 * ──────────────────────────────────────────────────────────── */

const PERSONA_IMAGES: Record<string, { src: string; name: string }> = {
  friendly_hr: { src: '/avatars/friendly_hr.png', name: 'Sarah' },
  strict_tech: { src: '/avatars/strict_tech.png', name: 'Ryan' },
  senior_em:   { src: '/avatars/senior_em.png',   name: 'Michael' },
  startup:     { src: '/avatars/startup.png',     name: 'Alex' },
  faang:       { src: '/avatars/faang.png',       name: 'Emily' },
  mentor:      { src: '/avatars/mentor.png',      name: 'David' },
};

const DEFAULT_PERSONA = 'faang';

/* ────────────────────────────────────────────────────────────
 * Component
 *
 * Renders a photorealistic character portrait with layered
 * CSS/canvas animations for each interview state:
 *   idle     → subtle breathing + periodic soft pulse
 *   listening → glowing accent ring, gentle scale
 *   thinking → pulsing ring + orbiting dots
 *   speaking → audio-reactive glow ring + subtle bounce
 * ──────────────────────────────────────────────────────────── */

export default function InterviewerAvatar({
  state,
  persona,
  rmsLevel = 0,
  size = 260,
}: InterviewerAvatarProps) {
  const personaKey = persona && PERSONA_IMAGES[persona] ? persona : DEFAULT_PERSONA;
  const character = PERSONA_IMAGES[personaKey];
  const [imageLoaded, setImageLoaded] = useState(false);

  // For the speaking glow intensity — use a smoothed version of rmsLevel
  const smoothedRms = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      smoothedRms.current += (rmsLevel - smoothedRms.current) * 0.3;
    }, 30);
    return () => clearInterval(interval);
  }, [rmsLevel]);

  // Ring animation for speaking — pulsing glow driven by RMS
  const glowIntensity = state === 'speaking'
    ? 8 + rmsLevel * 40
    : state === 'listening' ? 6 : 0;

  const ringColor = state === 'speaking'
    ? 'var(--accent)'
    : state === 'listening'
      ? 'var(--success)'
      : state === 'thinking'
        ? 'var(--warning)'
        : 'transparent';

  const borderWidth = state === 'idle' ? 3 : 4;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── Outer pulsing ring ── */}
      <motion.div
        animate={{
          scale: state === 'listening'
            ? [1, 1.08, 1]
            : state === 'speaking'
              ? [1, 1.04 + rmsLevel * 0.1, 1]
              : state === 'thinking'
                ? [1, 1.05, 1]
                : [1, 1.02, 1],
          opacity: state === 'idle' ? [0.3, 0.5, 0.3] : [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: state === 'speaking' ? 0.6 : state === 'thinking' ? 1.8 : 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          border: `2px solid ${ringColor}`,
          boxShadow: glowIntensity > 0 ? `0 0 ${glowIntensity}px ${ringColor}` : 'none',
          transition: 'border-color 300ms ease, box-shadow 300ms ease',
        }}
      />

      {/* ── Second outer ring (speaking only — audio-reactive) ── */}
      {state === 'speaking' && (
        <motion.div
          animate={{
            scale: [1, 1.12 + rmsLevel * 0.15, 1],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            inset: -16,
            borderRadius: '50%',
            border: '1.5px solid var(--accent)',
            boxShadow: `0 0 ${12 + rmsLevel * 30}px var(--accent)`,
          }}
        />
      )}

      {/* ── Thinking orbiting dots ── */}
      {state === 'thinking' && (
        <div
          style={{
            position: 'absolute',
            inset: -12,
            borderRadius: '50%',
            animation: 'avatarOrbit 3s linear infinite',
          }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5 }}
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--warning)',
                top: '50%',
                left: '50%',
                transform: `rotate(${i * 120}deg) translateX(${size / 2 + 10}px) translateY(-50%)`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Main avatar image ── */}
      <motion.div
        animate={{
          scale: state === 'speaking'
            ? [1, 1.01 + rmsLevel * 0.02, 1]
            : state === 'idle'
              ? [1, 1.005, 1]
              : 1,
          y: state === 'speaking'
            ? [0, -1 - rmsLevel * 3, 0]
            : 0,
        }}
        transition={{
          duration: state === 'speaking' ? 0.4 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `${borderWidth}px solid ${state === 'idle' ? 'var(--border-strong)' : ringColor}`,
          boxShadow: `var(--shadow-md), 0 0 ${glowIntensity * 0.5}px ${ringColor}`,
          transition: 'border-color 300ms ease, box-shadow 300ms ease',
          position: 'relative',
          background: 'var(--surface-sunken)',
        }}
      >
        {/* Placeholder while image loads */}
        {!imageLoaded && (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-sunken)',
              color: 'var(--ink-faint)',
              fontSize: size * 0.2,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
            }}
          >
            {character.name[0]}
          </div>
        )}

        <img
          src={character.src}
          alt={`${character.name} — AI Interviewer`}
          onLoad={() => setImageLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: imageLoaded ? 'block' : 'none',
          }}
        />

        {/* ── Speaking overlay — subtle mouth-area glow ── */}
        {state === 'speaking' && (
          <motion.div
            animate={{ opacity: [0.05, 0.15 + rmsLevel * 0.2, 0.05] }}
            transition={{ duration: 0.3, repeat: Infinity }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '40%',
              background: `linear-gradient(to top, var(--accent), transparent)`,
              borderRadius: '0 0 50% 50%',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Listening overlay — soft green tint ── */}
        {state === 'listening' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--success)',
              opacity: 0.06,
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />
        )}
      </motion.div>

      {/* ── Name badge ── */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '3px 14px',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-sm)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.03em',
        }}
      >
        {character.name}
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes avatarOrbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
