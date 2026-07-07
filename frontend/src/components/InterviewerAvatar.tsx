import { useRef, useEffect, useCallback } from 'react';

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface InterviewerAvatarProps {
  state: AvatarState;
  /** 0–1 RMS level used for lip-sync amplitude while speaking. */
  rmsLevel?: number;
  /** CSS width for the canvas. Height is set automatically (1:1). */
  size?: number;
}

/* ────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Read a CSS custom property from :root. Falls back to `fallback`. */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/* ────────────────────────────────────────────────────────────
 * Component
 *
 * A lightweight, canvas-based 2D avatar that reacts to the
 * interview state (idle / listening / thinking / speaking).
 *
 * Everything is drawn procedurally — no sprites, no images,
 * no external 3D libraries — so it adds zero network requests
 * and minimal JS to the bundle.
 * ──────────────────────────────────────────────────────────── */

export default function InterviewerAvatar({
  state,
  rmsLevel = 0,
  size = 260,
}: InterviewerAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Mutable animation state (lerped each frame for smooth transitions)
  const anim = useRef({
    // Mouth openness (0 = closed, 1 = fully open)
    mouthOpen: 0,
    // Blink (0 = eyes open, 1 = eyes fully closed)
    blink: 0,
    // When the next blink should happen (ms timestamp)
    nextBlink: performance.now() + 2000 + Math.random() * 3000,
    // Head sway angle (radians, subtle)
    headSway: 0,
    // Glow ring opacity (listening indicator)
    glowRing: 0,
    // Thinking eye offset (eyes glance sideways)
    eyeOffsetX: 0,
    // Breathing scale factor
    breathScale: 1,
    // Subtle nodding
    nodOffset: 0,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    const now = performance.now();
    const a = anim.current;
    const dt = 0.07; // lerp speed per frame (~60fps)

    // ── Resolve theme colors ──
    const accent = cssVar('--accent', '#6c85ff');
    const accentSoft = cssVar('--accent-soft', '#1c2340');
    const ink = cssVar('--ink', '#f1f1f3');
    const inkFaint = cssVar('--ink-faint', '#6d7078');
    const surface = cssVar('--surface-sunken', '#212328');

    // ── Target values based on state ──
    const targetMouth = state === 'speaking' ? Math.min(1, rmsLevel * 8 + 0.15) : 0;
    const targetGlow = state === 'listening' ? 1 : 0;
    const targetEyeOffsetX = state === 'thinking' ? Math.sin(now * 0.001) * 6 : 0;

    // ── Lerp towards targets ──
    a.mouthOpen = lerp(a.mouthOpen, targetMouth, dt * 2);
    a.glowRing = lerp(a.glowRing, targetGlow, dt);
    a.eyeOffsetX = lerp(a.eyeOffsetX, targetEyeOffsetX, dt);

    // ── Breathing ──
    a.breathScale = 1 + Math.sin(now * 0.0015) * 0.008;

    // ── Head sway ──
    const swaySpeed = state === 'speaking' ? 0.0012 : 0.0006;
    const swayAmp = state === 'speaking' ? 0.03 : 0.015;
    a.headSway = Math.sin(now * swaySpeed) * swayAmp;

    // ── Nodding (subtle, during speaking) ──
    a.nodOffset = state === 'speaking'
      ? Math.sin(now * 0.003) * 2 * Math.min(1, rmsLevel * 5)
      : lerp(a.nodOffset, 0, dt);

    // ── Blinking ──
    if (now >= a.nextBlink) {
      a.blink = 1;
      a.nextBlink = now + 150; // blink lasts ~150ms, next random blink after
    }
    if (a.blink > 0) {
      a.blink = lerp(a.blink, 0, 0.15);
      if (a.blink < 0.05) {
        a.blink = 0;
        a.nextBlink = now + 2500 + Math.random() * 4000;
      }
    }

    // ── Clear ──
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy + a.nodOffset);
    ctx.rotate(a.headSway);
    ctx.scale(a.breathScale, a.breathScale);

    const headRadius = Math.min(w, h) * 0.3;

    // ── Glow ring (listening state) ──
    if (a.glowRing > 0.01) {
      const pulseRadius = headRadius + 20 + Math.sin(now * 0.004) * 6;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = a.glowRing * (0.25 + Math.sin(now * 0.003) * 0.1);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Head ──
    ctx.beginPath();
    ctx.ellipse(0, 0, headRadius, headRadius * 1.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ── Eyes ──
    const eyeY = -headRadius * 0.15;
    const eyeSpacing = headRadius * 0.35;
    const eyeRadius = headRadius * 0.1;

    for (const side of [-1, 1]) {
      const ex = side * eyeSpacing + a.eyeOffsetX;
      const ey = eyeY;

      if (a.blink > 0.3) {
        // Blink — draw a horizontal line
        ctx.beginPath();
        ctx.moveTo(ex - eyeRadius, ey);
        ctx.lineTo(ex + eyeRadius, ey);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        // Open eye
        ctx.beginPath();
        ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();

        // Pupil
        const pupilRadius = eyeRadius * 0.5;
        ctx.beginPath();
        ctx.arc(ex + a.eyeOffsetX * 0.3, ey, pupilRadius, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
      }
    }

    // ── Eyebrows ──
    const browY = eyeY - eyeRadius - headRadius * 0.1;
    const browThinking = state === 'thinking' ? -3 : 0;
    for (const side of [-1, 1]) {
      const bx = side * eyeSpacing;
      ctx.beginPath();
      ctx.moveTo(bx - eyeRadius * 1.2, browY + browThinking + (side === -1 && state === 'thinking' ? -2 : 0));
      ctx.lineTo(bx + eyeRadius * 1.2, browY + browThinking + (side === 1 && state === 'thinking' ? -2 : 0));
      ctx.strokeStyle = inkFaint;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // ── Nose ──
    const noseY = headRadius * 0.05;
    ctx.beginPath();
    ctx.moveTo(-3, noseY - 4);
    ctx.quadraticCurveTo(0, noseY + 4, 3, noseY - 4);
    ctx.strokeStyle = inkFaint;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Mouth ──
    const mouthY = headRadius * 0.35;
    const mouthWidth = headRadius * 0.4;
    const openAmount = a.mouthOpen * headRadius * 0.2;

    if (openAmount > 1) {
      // Open mouth — ellipse
      ctx.beginPath();
      ctx.ellipse(0, mouthY, mouthWidth * (0.5 + a.mouthOpen * 0.3), openAmount, 0, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Closed — slight smile
      ctx.beginPath();
      ctx.moveTo(-mouthWidth * 0.6, mouthY);
      ctx.quadraticCurveTo(0, mouthY + 8, mouthWidth * 0.6, mouthY);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();

    // ── Thinking dots (below avatar) ──
    if (state === 'thinking') {
      for (let i = 0; i < 3; i++) {
        const dotX = cx - 16 + i * 16;
        const dotY = cy + headRadius * 1.15 + 28;
        const bounce = Math.sin(now * 0.005 + i * 0.7) * 4;
        ctx.beginPath();
        ctx.arc(dotX, dotY + bounce, 4, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.5 + Math.sin(now * 0.004 + i * 0.8) * 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── Status ring color (subtle ring around head for each state) ──
    if (state === 'speaking') {
      const pulse = 0.15 + Math.sin(now * 0.005) * 0.08;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, headRadius + 14, 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [state, rmsLevel]);

  // ── Canvas setup ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [size, draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
      }}
    />
  );
}
