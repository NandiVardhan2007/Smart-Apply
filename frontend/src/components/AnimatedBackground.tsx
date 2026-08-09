import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'var(--paper)',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      {/* Background Grid Pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 30%, #000 70%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 30%, #000 70%, transparent 100%)',
          opacity: 0.8,
        }}
      />

      {/* Top Center Hero Radial Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%) translateZ(0)',
          width: '70vw',
          height: '400px',
          background: 'radial-gradient(ellipse at top, rgba(79, 109, 245, 0.25) 0%, rgba(124, 92, 245, 0.12) 40%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Optimized GPU Floating Neon Orbs (Radial gradients without heavy CSS blurs) */}
      <motion.div
        animate={{
          x: ['0vw', '6vw', '0vw'],
          y: ['0vh', '8vh', '0vh'],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '45vw',
          height: '45vw',
          background: 'radial-gradient(circle, rgba(79, 109, 245, 0.14) 0%, rgba(79, 109, 245, 0.04) 50%, transparent 70%)',
          borderRadius: '50%',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />

      <motion.div
        animate={{
          x: ['0vw', '-8vw', '0vw'],
          y: ['0vh', '10vh', '0vh'],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '35%',
          right: '5%',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(56, 189, 248, 0.03) 50%, transparent 70%)',
          borderRadius: '50%',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />

      <motion.div
        animate={{
          x: ['0vw', '5vw', '0vw'],
          y: ['0vh', '-10vh', '0vh'],
        }}
        transition={{
          duration: 32,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '25%',
          width: '55vw',
          height: '55vw',
          background: 'radial-gradient(circle, rgba(124, 92, 245, 0.12) 0%, rgba(124, 92, 245, 0.03) 50%, transparent 70%)',
          borderRadius: '50%',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />
    </div>
  );
}
