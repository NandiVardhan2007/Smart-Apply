import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ScanSearch, 
  Wand2, 
  MessageSquareText, 
  Lightbulb, 
  Video, 
  ArrowRight, 
  Check, 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  Bot, 
  FileText,
  Building2,
  Users,
  Award,
  ChevronRight
} from 'lucide-react';

import Navbar from '../components/Navbar';
import AnimatedBackground from '../components/AnimatedBackground';
import { useAuth } from '../context/AuthContext';

const HERO_POSTERS = [
  {
    title: 'ATS Score Optimizer',
    subtitle: 'Beat ATS filters with instant keyword matching',
    bg: 'linear-gradient(135deg, #e52e71 0%, #ff8a00 100%)',
    badge: '98% Pass Rate',
    icon: ScanSearch
  },
  {
    title: '1-Click Resume Tailor',
    subtitle: 'Extract & rewrite bullet points tailored for target roles',
    bg: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
    badge: 'Instant AI',
    icon: Wand2
  },
  {
    title: 'Live AI Interviewer',
    subtitle: 'Talk with an interactive AI mock interviewer in real time',
    bg: 'linear-gradient(135deg, #8a2387 0%, #e94057 50%, #f27121 100%)',
    badge: 'Voice & Vision',
    icon: Video
  },
  {
    title: 'Smart Career Copilot',
    subtitle: 'Cover letters, salary tips & custom interview prep answers',
    bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    badge: 'Context-Aware',
    icon: MessageSquareText
  },
  {
    title: 'Skill Gap & Project Roadmap',
    subtitle: 'Identify missing skills and build portfolio projects with roadmaps',
    bg: 'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)',
    badge: 'Growth Engine',
    icon: Lightbulb
  }
];

const PILLARS = [
  {
    id: '01',
    category: 'ATS & RESUME OPTIMIZATION',
    title: 'Financial-Grade Keyword & Resume Alignment',
    description: 'Transform raw resumes into precision ATS-optimized application documents. Our engine parses job specs line by line to maximize candidate match scores.',
    badge: 'Pillar 01',
    bg: 'linear-gradient(135deg, rgba(79, 109, 245, 0.08) 0%, rgba(124, 92, 245, 0.15) 100%)',
    icon: ScanSearch
  },
  {
    id: '02',
    category: 'AI CAREER INTELLIGENCE',
    title: 'Strategic Career Copilot & Negotiation Support',
    description: 'Trained on high-growth tech hires. Get tailored cover letters, elevator pitches, and salary negotiation scripts engineered for maximum leverage.',
    badge: 'Pillar 02',
    bg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(79, 109, 245, 0.15) 100%)',
    icon: MessageSquareText
  },
  {
    id: '03',
    category: 'LIVE INTERVIEW AUTOMATION',
    title: 'Real-Time Interactive AI Mock Interviews',
    description: 'Rehearse technical and behavioral rounds with an AI avatar interviewer. Receive real-time speech telemetry, posture hints, and score breakdowns.',
    badge: 'Pillar 03',
    bg: 'linear-gradient(135deg, rgba(232, 213, 245, 0.15) 0%, rgba(124, 92, 245, 0.12) 100%)',
    icon: Video
  }
];

const LOGOS = ['Google', 'Meta', 'Amazon', 'Microsoft', 'Netflix', 'Apple', 'Uber', 'Stripe'];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const featuresRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'ats' | 'interview'>('all');

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, 50]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <AnimatedBackground />
      <Navbar />

      {/* Hero Section */}
      <section 
        style={{ 
          padding: '150px 24px 70px', 
          textAlign: 'center', 
          position: 'relative',
          zIndex: 10
        }}
      >
        <motion.div 
          style={{ y: heroY, maxWidth: 1240, margin: '0 auto' }}
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Row of 5 3D Poster Feature Cards */}
          <div className="hero-poster-container">
            {HERO_POSTERS.map((poster, idx) => (
              <motion.div
                key={poster.title}
                className="hero-poster-card"
                style={{ background: poster.bg }}
                whileHover={{ scale: 1.05 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(4px)' }}>
                    {poster.badge}
                  </span>
                  <poster.icon size={22} color="#ffffff" />
                </div>

                <div>
                  <h3 style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25, marginBottom: 8, color: '#ffffff' }}>
                    {poster.title}
                  </h3>
                  <p style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4, margin: 0, color: '#ffffff' }}>
                    {poster.subtitle}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Centered Main Hero Title */}
          <h1 style={{ 
            fontSize: 'clamp(38px, 5.5vw, 68px)', 
            lineHeight: 1.1, 
            fontWeight: 800, 
            maxWidth: 980, 
            margin: '0 auto 20px', 
            letterSpacing: '-0.035em',
            color: '#ffffff'
          }}>
            AI-Powered Execution Ecosystem for <span className="gradient-text">Modern Job Seekers</span>
          </h1>
          
          {/* Subtitle */}
          <p style={{ 
            fontSize: 'clamp(16px, 1.8vw, 20px)', 
            maxWidth: 760, 
            margin: '0 auto 36px', 
            lineHeight: 1.6, 
            color: 'var(--ink-soft)' 
          }}>
            SmartApply enables candidates and ambitious professionals to execute with precision, combining AI-driven resume tailoring with real-time mock interviews to deliver outcome-focused results.
          </p>
          
          {/* Hero CTAs */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 50 }}>
            <button 
              className="btn btn-lg" 
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}
              style={{ 
                background: '#e8d5f5', 
                color: '#0b0b1a', 
                borderRadius: 14, 
                padding: '16px 40px', 
                fontSize: 16, 
                fontWeight: 600,
                boxShadow: '0 8px 30px rgba(232, 213, 245, 0.25)',
                border: 'none'
              }}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Request Access / Start Free'} <ArrowRight size={18} />
            </button>
            <a 
              href="#pillars" 
              className="btn btn-lg"
              style={{ 
                background: 'transparent', 
                border: '1.6px solid rgba(255, 255, 255, 0.4)', 
                color: '#ffffff',
                borderRadius: 14,
                padding: '16px 36px',
                fontSize: 16,
                fontWeight: 600
              }}
            >
              Explore Services
            </a>
          </div>

          {/* Marquee Logo Ticker */}
          <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, paddingBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              Candidate Alumni Landed Offers At
            </span>
            <div className="marquee-ticker">
              <div className="marquee-content">
                {LOGOS.concat(LOGOS).map((logo, i) => (
                  <span key={i} style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.05em' }}>
                    {logo}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3 Pillars of Execution Showcase */}
      <section id="pillars" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span className="eyebrow" style={{ color: '#4f6df5', letterSpacing: '0.12em' }}>THE THREE PILLARS OF EXECUTION</span>
            <h2 style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', fontWeight: 800, marginTop: 10, color: '#ffffff' }}>
              Engineered for precision results.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 28 }}>
            {PILLARS.map((pillar, idx) => (
              <motion.div
                key={pillar.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.15 }}
                className="glow-card"
                style={{
                  padding: '36px 30px',
                  borderRadius: 22,
                  background: pillar.bg,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 380
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#4f6df5', padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.9)' }}>
                      {pillar.badge}
                    </span>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: '#0b0e17',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
                    }}>
                      <pillar.icon size={24} />
                    </div>
                  </div>

                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                    {pillar.category}
                  </span>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginTop: 8, marginBottom: 14, lineHeight: 1.3 }}>
                    {pillar.title}
                  </h3>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
                    {pillar.description}
                  </p>
                </div>

                <div 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#ffffff', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 24 }}
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}
                >
                  Book Discovery Call <ChevronRight size={16} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div
            className="glass-panel"
            style={{
              textAlign: 'center',
              padding: '70px 36px',
              borderRadius: 24,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #0b0e17 0%, #151a2a 100%)',
              border: '1px solid rgba(79, 109, 245, 0.3)'
            }}
          >
            <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 800, color: '#ffffff', marginBottom: 16 }}>
              Start your career transformation today.
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 17, maxWidth: 580, margin: '0 auto 36px', lineHeight: 1.6 }}>
              Join thousands of job seekers using SmartApply to streamline resume optimization and ace every interview round.
            </p>
            <button 
              className="btn btn-lg" 
              onClick={() => navigate('/signup')}
              style={{ 
                background: '#e8d5f5', 
                color: '#0b0b1a', 
                borderRadius: 14, 
                padding: '16px 36px', 
                fontSize: 16, 
                fontWeight: 600,
                border: 'none'
              }}
            >
              Get Started Free <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '40px 24px', position: 'relative', zIndex: 10, background: '#07080c' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#0b0e17',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 14, filter: 'brightness(0) invert(1)' }} />
            </div>
            <span style={{ fontWeight: 700, color: '#ffffff', fontSize: 16 }}>SmartApply</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-faint)' }}>© {new Date().getFullYear()} Smart Apply Ecosystem. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
