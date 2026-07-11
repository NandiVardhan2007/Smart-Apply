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
        background: 'var(--bg-primary)',
      }}
    >
      <motion.div
        animate={{
          x: ['0vw', '10vw', '0vw'],
          y: ['0vh', '15vh', '0vh'],
          rotate: [0, 45, 0],
        }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(0, 112, 243, 0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}
      />
      <motion.div
        animate={{
          x: ['0vw', '-15vw', '0vw'],
          y: ['0vh', '10vh', '0vh'],
          rotate: [0, -30, 0],
        }}
        transition={{
          duration: 50,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          top: '40%',
          right: '-10%',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
        }}
      />
      <motion.div
        animate={{
          x: ['0vw', '5vw', '0vw'],
          y: ['0vh', '-20vh', '0vh'],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 44,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          bottom: '-20%',
          left: '20%',
          width: '70vw',
          height: '70vw',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(90px)',
        }}
      />
    </div>
  );
}
