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
  ShieldCheck, 
  Cpu, 
  Bot, 
  TrendingUp, 
  FileText 
} from 'lucide-react';

import Navbar from '../components/Navbar';
import AnimatedBackground from '../components/AnimatedBackground';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'ATS Keyword Checker',
    description: 'Score your resume against any target job description instantly. Uncover missing keywords, match rates, and formatting issues before human recruiters view it.',
    badge: 'Real-Time Scanning',
    span: 'col-span-12 md:col-span-6 lg:col-span-4'
  },
  {
    icon: Wand2,
    title: 'AI Resume Tailoring Engine',
    description: 'Extract your resume into our visual editor. Tailor bullet points, highlight relevant experience, and export polished PDFs in seconds.',
    badge: '1-Click Optimization',
    span: 'col-span-12 md:col-span-6 lg:col-span-4'
  },
  {
    icon: Video,
    title: 'Live AI Interview Simulator',
    description: 'Practice mock technical and behavioral interviews with an interactive AI interviewer that analyzes your voice, content depth, and facial cues.',
    badge: 'Real-Time Feedback',
    span: 'col-span-12 md:col-span-12 lg:col-span-4'
  },
  {
    icon: MessageSquareText,
    title: 'Smart Career Copilot Chat',
    description: 'Generate customized cover letters, salary negotiation scripts, and interview prep answers from an AI advisor tuned to your career profile.',
    badge: 'Context-Aware',
    span: 'col-span-12 md:col-span-6 lg:col-span-6'
  },
  {
    icon: Lightbulb,
    title: 'Skill Gap & Project Roadmap',
    description: 'Identify resume gaps for your target job title and get actionable project ideas complete with step-by-step technical roadmaps.',
    badge: 'Career Growth',
    span: 'col-span-12 md:col-span-6 lg:col-span-6'
  },
];

const METRICS = [
  { value: '98%', label: 'ATS Pass Rate' },
  { value: '10x', label: 'Faster Applications' },
  { value: '50k+', label: 'Resumes Tailored' },
  { value: '< 2m', label: 'Setup Time' },
];

const STEPS = [
  { 
    n: '01', 
    title: 'Upload Your Master Resume', 
    description: 'Drop in a PDF or DOCX file. Our AI instantly parses your skills, education, and career experience into an editable profile.' 
  },
  { 
    n: '02', 
    title: 'Paste Job Description & Score', 
    description: 'Compare your resume against any role. Get an instant match percentage, keyword breakdown, and tailored bullet suggestions.' 
  },
  { 
    n: '03', 
    title: 'Rehearse & Apply with Confidence', 
    description: 'Conduct a live mock interview with your AI co-pilot, receive instant scoring reports, and apply ready to get hired.' 
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  
  const [demoTab, setDemoTab] = useState<'scan' | 'tailor' | 'chat'>('scan');

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, 60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.2]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
      <AnimatedBackground />
      <Navbar />

      {/* Hero Section */}
      <section 
        style={{ 
          padding: '160px 24px 80px', 
          textAlign: 'center', 
          minHeight: '92vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10
        }}
      >
        <motion.div 
          className="container"
          style={{ y: heroY, opacity: heroOpacity, maxWidth: 1100, margin: '0 auto' }}
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Pill Badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="pill-badge"
            style={{ marginBottom: 28 }}
          >
            <span style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: '#38bdf8', 
              boxShadow: '0 0 10px #38bdf8' 
            }} />
            <Sparkles size={14} /> AI-Powered Career Execution Ecosystem
          </motion.div>
          
          {/* Main Title */}
          <h1 style={{ 
            fontSize: 'clamp(42px, 6vw, 76px)', 
            lineHeight: 1.08, 
            fontWeight: 800, 
            maxWidth: 960, 
            margin: '0 auto 24px', 
            letterSpacing: '-0.03em',
            color: '#ffffff'
          }}>
            Land your dream role with an <span className="gradient-text">AI co-pilot</span> for every step.
          </h1>
          
          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{ 
              fontSize: 'clamp(17px, 2vw, 21px)', 
              maxWidth: 720, 
              margin: '0 auto 40px', 
              lineHeight: 1.6, 
              color: 'var(--ink-soft)' 
            }}
          >
            Smart Apply scores your resume against target ATS filters, generates tailored applications, and conducts real-time AI mock interviews.
          </motion.p>
          
          {/* Hero CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}
          >
            <button 
              className="btn btn-glow btn-lg" 
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}
              style={{ fontSize: 16, padding: '16px 32px' }}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Start Free Trial'} <ArrowRight size={18} />
            </button>
            <a 
              href="#features" 
              className="btn btn-secondary btn-lg"
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderColor: 'rgba(255, 255, 255, 0.12)', 
                color: '#f8fafc',
                fontSize: 16,
                padding: '16px 28px'
              }}
            >
              Explore Features
            </a>
          </motion.div>

          {/* Interactive AI Co-Pilot Hero Preview Widget */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel"
            style={{
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              textAlign: 'left',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Top Bar of Preview */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: 16,
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: 13, color: 'var(--ink-faint)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
                  smartapply-copilot v2.4.0
                </span>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 8 }}>
                {(['scan', 'tailor', 'chat'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDemoTab(t)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      border: 'none',
                      background: demoTab === t ? 'var(--accent)' : 'transparent',
                      color: demoTab === t ? '#fff' : 'var(--ink-soft)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textTransform: 'capitalize'
                    }}
                  >
                    {t === 'scan' ? '⚡ ATS Match' : t === 'tailor' ? '✨ Resume Tailor' : '🤖 AI Mock Interview'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            {demoTab === 'scan' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'center' }}>
                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>ATS Score Analysis</span>
                    <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={12} /> High Match
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                    <div style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
                      border: '3px solid #10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
                    }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>94%</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>Match Score</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>Target Role: Senior Full Stack Engineer</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>18 / 20 Essential Keywords Found</div>
                    </div>
                  </div>

                  {/* Missing Keyword Badges */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 8, fontWeight: 600 }}>Detected Skills & Keyword Alignment:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: 12, border: '1px solid rgba(16, 185, 129, 0.3)' }}>React.js ✓</span>
                      <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: 12, border: '1px solid rgba(16, 185, 129, 0.3)' }}>TypeScript ✓</span>
                      <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: 12, border: '1px solid rgba(16, 185, 129, 0.3)' }}>Node.js ✓</span>
                      <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: 12, border: '1px solid rgba(239, 68, 68, 0.3)' }}>+ Docker (Suggested)</span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={16} color="#818cf8" /> Live AI Optimization Output
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 12 }}>
                    "Architected high-throughput microservices using <strong style={{ color: '#818cf8' }}>Node.js & TypeScript</strong>, improving system latency by <strong style={{ color: '#34d399' }}>42%</strong> across 500k+ active users."
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-faint)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                    <span>AI Confidence: 99.2%</span>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>1-Click Insert →</span>
                  </div>
                </div>
              </div>
            )}

            {demoTab === 'tailor' && (
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <FileText size={18} color="#38bdf8" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>Automatic Resume Bullet Enhancer</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, borderLeft: '3px solid #6366f1' }}>
                  <div style={{ color: '#94a3b8', textDecoration: 'line-through', marginBottom: 4 }}>Before: Worked on backend database queries for client app.</div>
                  <div style={{ color: '#38bdf8', fontWeight: 500 }}>After: Designed indexed PostgreSQL database schemas, reducing query turnaround times by 65% for enterprise clients.</div>
                </div>
              </div>
            )}

            {demoTab === 'chat' && (
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={22} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginBottom: 2 }}>AI Mock Interviewer</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>"Tell me about a time you had to optimize an application under heavy load?"</div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Metrics Bar */}
      <section style={{ padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15, 17, 26, 0.4)', position: 'relative', zIndex: 10 }}>
        <div className="container" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, textAlign: 'center' }}>
            {METRICS.map((m) => (
              <div key={m.label}>
                <div style={{ fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }} className="gradient-text">
                  {m.value}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 8, fontWeight: 500 }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" style={{ padding: '120px 24px', position: 'relative', zIndex: 10 }}>
        <div className="container" ref={featuresRef} style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="eyebrow" style={{ color: '#818cf8' }}>Full-Stack Career Automation</span>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, marginTop: 12, color: '#ffffff' }}>
              Built for ambitious professionals.
            </h2>
            <p style={{ fontSize: 17, color: 'var(--ink-soft)', maxWidth: 600, margin: '16px auto 0' }}>
              Stop manually tailoring resumes and guessing ATS metrics. SmartApply handles the entire application pipeline.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {FEATURES.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glow-card"
                style={{
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 17, 26, 0.75)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: '#818cf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
                      }}
                    >
                      <feature.icon size={26} />
                    </div>
                    <span style={{ 
                      fontSize: 11.5, 
                      fontWeight: 700, 
                      padding: '4px 10px', 
                      borderRadius: 999, 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      color: '#94a3b8',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      {feature.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#ffffff' }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                    {feature.description}
                  </p>
                </div>

                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 6, color: '#818cf8', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}>
                  Explore Feature <ArrowRight size={14} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works (Step Workflow) */}
      <section id="how-it-works" style={{ padding: '120px 24px', background: 'rgba(7, 8, 12, 0.6)', borderTop: '1px solid rgba(255, 255, 255, 0.06)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', position: 'relative', zIndex: 10 }}>
        <div className="container" ref={stepsRef} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="eyebrow" style={{ color: '#38bdf8' }}>Seamless Workflow</span>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, marginTop: 12, color: '#ffffff' }}>
              Three steps to your next job offer.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.15 }}
                className="glass-panel"
                style={{
                  padding: '36px 28px',
                  borderRadius: 'var(--radius-lg)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ 
                  fontSize: 72, 
                  fontWeight: 900, 
                  color: 'rgba(255, 255, 255, 0.04)', 
                  position: 'absolute', 
                  top: 10, 
                  right: 20,
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1
                }}>
                  {step.n}
                </div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 20,
                    border: '1px solid rgba(99, 102, 241, 0.4)'
                  }}>
                    {step.n}
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginBottom: 12 }}>{step.title}</h3>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* High-Impact CTA Banner */}
      <section style={{ padding: '120px 24px', position: 'relative', zIndex: 10 }}>
        <div className="container" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-panel"
            style={{
              textAlign: 'center',
              padding: '80px 32px',
              borderRadius: 'var(--radius-lg)',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              boxShadow: '0 0 50px rgba(99, 102, 241, 0.15)'
            }}
          >
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, color: '#ffffff', marginBottom: 20 }}>
                Ready to transform your job search?
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 18, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
                Create your free account now and get your first ATS score in under 2 minutes. No credit card required.
              </p>
              
              <button 
                className="btn btn-glow btn-lg" 
                onClick={() => navigate('/signup')}
                style={{ fontSize: 16, padding: '16px 36px' }}
              >
                Get Started Free <ArrowRight size={18} />
              </button>

              <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
                {['No credit card required', 'Free tier included', 'Instant setup'].map((item) => (
                  <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 14, fontWeight: 500 }}>
                    <Check size={16} color="#10b981" /> {item}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '40px 24px', position: 'relative', zIndex: 10, background: 'rgba(7, 8, 12, 0.9)' }}>
        <div className="container" style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 14, filter: 'brightness(0) invert(1)' }} />
            </div>
            <span style={{ fontWeight: 700, color: '#ffffff', fontSize: 16 }}>SmartApply</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-faint)' }}>© {new Date().getFullYear()} Smart Apply AI Ecosystem. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
