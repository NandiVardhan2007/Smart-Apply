import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ScanSearch, Wand2, MessageSquareText, Lightbulb, Video, ArrowRight, Check, Sparkles } from 'lucide-react';

import Navbar from '../components/Navbar';
import AnimatedBackground from '../components/AnimatedBackground';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'ATS Checker',
    description: 'Score your resume against any job description and see exactly which keywords are missing to get past the filters.',
  },
  {
    icon: Wand2,
    title: 'Resume Tailoring',
    description: 'Extract your resume into our visual editor — then edit and re-export tailored versions in seconds.',
  },
  {
    icon: MessageSquareText,
    title: 'AI Career Chat',
    description: 'Get cover letters, interview answers, and salary negotiation advice from an advisor that knows your profile.',
  },
  {
    icon: Lightbulb,
    title: 'Project Recommendations',
    description: 'Get project ideas matched to your skills and time, complete with a phased build roadmap.',
  },
  {
    icon: Video,
    title: 'Live Interview Practice',
    description: 'Talk through a real-time mock interview with an AI interviewer that reads your expressions and gives feedback.',
  },
];

const STEPS = [
  { n: '01', title: 'Upload your resume', description: 'Drop in a PDF and let AI extract your skills, education, and experience.' },
  { n: '02', title: 'Optimize for the role', description: 'Check your ATS score against a job description and tailor your resume.' },
  { n: '03', title: 'Practice & apply', description: 'Rehearse with a live AI interviewer, then apply with confidence.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);



  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <AnimatedBackground />
      <Navbar />

      {/* Hero */}
      <section 
        style={{ 
          padding: '160px 24px 120px', 
          textAlign: 'center', 
          minHeight: '90vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10
        }}
      >
        <motion.div 
          className="container"
          style={{ y: heroY, opacity: heroOpacity }}
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '6px 16px', 
              background: 'var(--accent-soft)', 
              color: 'var(--accent)', 
              borderRadius: 'var(--radius-xl)', 
              fontSize: '0.85rem', 
              fontWeight: 600,
              marginBottom: 32,
              border: '1px solid var(--border-accent)'
            }}
          >
            <Sparkles size={14} /> AI-Powered Job Search
          </motion.div>
          
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 72px)', lineHeight: 1.05, maxWidth: 900, margin: '0 auto 24px', letterSpacing: '-0.03em' }}>
            Land your next role with an <span className="text-accent">AI co-pilot</span> for every step.
          </h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-secondary" 
            style={{ fontSize: 'clamp(16px, 2vw, 20px)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.6 }}
          >
            Smart Apply tailors your resume, scores it against real job descriptions, and rehearses interviews with you —
            so you walk in prepared.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <button className="btn btn-primary btn-lg" onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}>
              {isAuthenticated ? 'Go to dashboard' : 'Start your journey'} <ArrowRight size={18} />
            </button>
            <a href="#features" className="btn btn-secondary btn-lg">
              See how it works
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '120px 24px', position: 'relative', zIndex: 10 }}>
        <div className="container" ref={featuresRef}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <span className="eyebrow">The Complete Toolkit</span>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', marginTop: 8 }}>Everything you need to succeed</h2>
          </div>

          <div className="grid-auto-fit">
            {FEATURES.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease: "easeOut" }}
                className="card feature-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius)',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    border: '1px solid var(--border-accent)',
                  }}
                >
                  <feature.icon size={24} />
                </div>
                <h3 style={{ fontSize: 20, marginBottom: 12 }}>{feature.title}</h3>
                <p className="text-secondary" style={{ fontSize: 15, lineHeight: 1.6 }}>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '120px 24px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--border-thin)', borderBottom: '1px solid var(--border-thin)', position: 'relative', zIndex: 10 }}>
        <div className="container" ref={stepsRef}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <span className="eyebrow">Simple by design</span>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', marginTop: 8 }}>Three steps to your next offer</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40 }}>
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8, delay: idx * 0.2, ease: "easeOut" }}
                className="step-card"
                style={{
                  padding: '32px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                }}
              >
                <div style={{ 
                  fontSize: 80, 
                  fontWeight: 900, 
                  color: 'var(--bg-card)', 
                  position: 'absolute', 
                  top: -20, 
                  right: 20,
                  zIndex: 0,
                  WebkitTextStroke: '1px var(--border-color)'
                }}>
                  {step.n}
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>Step {step.n}</div>
                  <h3 style={{ fontSize: 22, marginBottom: 12 }}>{step.title}</h3>
                  <p className="text-secondary" style={{ fontSize: 15, lineHeight: 1.6 }}>{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '120px 24px', position: 'relative', zIndex: 10 }}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="glass-panel"
            style={{
              textAlign: 'center',
              padding: '80px 40px',
              borderRadius: 'var(--radius-xl)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              height: '100%',
              background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.15) 0%, rgba(0,0,0,0) 70%)',
              zIndex: 0,
              pointerEvents: 'none'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', marginBottom: 20 }}>Ready to apply smarter?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 18, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px' }}>
                Create your free account and get your first ATS score in minutes. Stop guessing and start landing interviews.
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/signup')}>
                Get started free <ArrowRight size={18} />
              </button>
              <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
                {['No credit card required', 'Free forever plan', 'Cancel anytime'].map((item) => (
                  <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
                    <Check size={16} color="var(--success)" /> {item}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-thin)', padding: '40px 24px', position: 'relative', zIndex: 10, background: 'var(--bg-primary)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 24 }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>SmartApply</span>
          </div>
          <p className="text-muted" style={{ fontSize: 14 }}>© {new Date().getFullYear()} Smart Apply. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
