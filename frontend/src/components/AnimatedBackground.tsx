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
          transform: 'translateX(-50%)',
          width: '70vw',
          height: '400px',
          background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.12) 40%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Floating Animated Neon Orbs */}
      <motion.div
        animate={{
          x: ['0vw', '8vw', '0vw'],
          y: ['0vh', '12vh', '0vh'],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '45vw',
          height: '45vw',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(70px)',
        }}
      />

      <motion.div
        animate={{
          x: ['0vw', '-10vw', '0vw'],
          y: ['0vh', '15vh', '0vh'],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '35%',
          right: '5%',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
        }}
      />

      <motion.div
        animate={{
          x: ['0vw', '6vw', '0vw'],
          y: ['0vh', '-15vh', '0vh'],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '25%',
          width: '55vw',
          height: '55vw',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.14) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(90px)',
        }}
      />
    </div>
  );
}

