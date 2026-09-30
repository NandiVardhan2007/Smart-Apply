import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, ChevronDown } from 'lucide-react';
import CinematicParticleCanvas from './CinematicParticleCanvas';
import FloatingVioletOrbs from './FloatingVioletOrbs';

interface Props {
  onExploreClick?: () => void;
}

export default function CinematicHeroSection({ onExploreClick }: Props) {
  return (
    <section
      id="cinematic-hero"
      className="relative w-full min-h-screen bg-[#050308] text-[#F7F2FF] flex flex-col items-center overflow-hidden select-none"
    >
      {/* ── Layer 0: Pure Deep Black & Soft Background Purple Light ─────── */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[#050308]" />
      
      {/* ── Core Glow Source (Behind particles and text) ──────────────── */}
      <motion.div
        className="absolute inset-0 z-[1] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85vw] max-w-[1000px] h-[70vh] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(118, 33, 176, 0.28) 0%, rgba(48, 0, 107, 0.18) 45%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
      </motion.div>

      {/* ── Layer 1: Atmospheric Canvas Particles ─────────────────────── */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        <CinematicParticleCanvas />
      </div>

      {/* ── Layer 2: Floating Ambient Parallax Orbs ───────────────────── */}
      <div className="absolute inset-0 z-[3] pointer-events-none">
        <FloatingVioletOrbs scrollYProgress={null as any} />
      </div>

      {/* ── Layer 3: Radial Vignette Overlay ──────────────────────────── */}
      <div
        className="absolute inset-0 z-[4] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 50% 50%, transparent 0%, rgba(5, 3, 8, 0.4) 40%, rgba(5, 3, 8, 0.95) 100%)',
        }}
      />

      {/* ── Top Bar ───────────────────────────────────────────────────── */}
      <header className="relative z-30 w-full px-6 sm:px-10 pt-6 sm:pt-8 flex justify-between items-center pointer-events-auto">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="SmartApply"
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
          />
          <span
            className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-[#F7F2FF] uppercase"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            SmartApply
          </span>
        </div>
      </header>

      {/* ── Center Stage: Typography & Identity Reveal ────────────────── */}
      <div className="relative z-20 flex-1 flex flex-col justify-center items-center px-4 w-full h-full pb-24">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="flex flex-col items-center text-center mt-12"
        >
          <div className="w-full max-w-7xl flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 mb-6">
            <h1
              className="font-black uppercase tracking-tight text-[#F7F2FF] leading-none text-center"
              style={{
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                fontSize: 'clamp(3.5rem, 10vw, 8rem)',
                textShadow: '0 4px 40px rgba(118, 33, 176, 0.35)',
              }}
            >
              SMART APPLY
            </h1>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="relative flex flex-col items-center"
          >
            {/* Logo Emblem directly inline */}
            <div className="relative w-[140px] h-[140px] sm:w-[180px] sm:h-[180px] mb-8">
               <div className="absolute inset-0 rounded-full bg-[#7621B0] opacity-40 blur-3xl animate-pulse" />
               <img
                 src="/logo.png"
                 alt="SmartApply AI"
                 className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]"
               />
            </div>

            <p className="max-w-2xl text-[#EAD7FF] text-lg sm:text-xl font-medium tracking-wide mb-10 opacity-90 text-center">
              Your AI-powered career co-pilot. Tailor resumes, generate cover letters, and master interviews instantly.
            </p>

            <button
              onClick={onExploreClick}
              className="relative group overflow-hidden bg-gradient-to-r from-[#9B00FF] to-[#7621B0] hover:from-[#A81BFF] hover:to-[#832DC0] text-white font-semibold rounded-full px-10 py-4 shadow-[0_0_40px_rgba(155,0,255,0.4)] transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-3">
                Start Building Your Future
                <ChevronDown className="w-5 h-5 animate-bounce" />
              </span>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
