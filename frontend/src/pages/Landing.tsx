import { Link } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { FileSearch, MessageSquare, Mic, Shield, ArrowDownRight, Bot, Zap } from 'lucide-react';
import '../styles/landing.css';

const features = [
  {
    icon: FileSearch,
    title: 'ATS Resume Checker',
    desc: 'Upload your resume and a job description — our AI analyzes ATS compatibility, highlights matching keywords, and suggests improvements.',
  },
  {
    icon: MessageSquare,
    title: 'AI Career Chatbot',
    desc: 'Get personalized career advice, cover letter help, and job search strategies from our AI-powered career advisor.',
  },
  {
    icon: Mic,
    title: 'AI Interview Practice',
    desc: 'Practice with AI-generated interview questions tailored to your target role. Get instant feedback on your answers.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'Your data is encrypted and stored securely. We never share your personal information or resumes with third parties.',
  }
];

const stats = [
  { value: '10K+', label: 'Resumes Analyzed' },
  { value: '95%', label: 'User Satisfaction' },
  { value: '50+', label: 'Job Categories' },
  { value: '24/7', label: 'AI Availability' },
];

function TiltFeatureCard({ feature, index }: { feature: typeof features[number]; index: number }) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), { stiffness: 280, damping: 22 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), { stiffness: 280, damping: 22 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.div
      className="feature-card"
      style={{ perspective: 900 }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      viewport={{ once: true }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="feature-icon">
          <feature.icon size={26} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '12px' }}>{feature.title}</h3>
        <p style={{ color: 'var(--text-muted)' }}>{feature.desc}</p>
      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="landing-page relative min-h-screen w-full flex flex-col bg-primary text-primary-foreground">
      
      {/* Background Dot Grid */}
      <div className="bg-dots" />

      {/* Hero */}
      <main className="hero relative flex-1 flex flex-col justify-center pt-40 pb-20 z-10" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="hero-typography-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 24px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          
          {/* Line 1 */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'center', position: 'relative', flexWrap: 'wrap' }}>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textAlign: 'right',
                maxWidth: '220px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}
            >
              Hi, we are Smart Apply. We build practical tools to help you land your dream job.
            </motion.p>
            <div style={{ position: 'relative' }}>
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{ position: 'absolute', top: '-24px', right: '8px', zIndex: 20 }}
              >
                <div className="glass-bubble">
                  <FileSearch size={16} />
                  <span>ATS Check</span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-massive"
              >
                SMART
              </motion.div>
            </div>
          </div>

          {/* Line 2 */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ position: 'absolute', top: '-32px', left: '16px', zIndex: 20 }}
              >
                <div className="glass-bubble">
                  <Mic size={16} />
                  <span>Interview</span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-massive"
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <span>CARE</span>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ margin: '0 0.05em' }}
                >
                  <Bot className="text-accent" style={{ width: '0.8em', height: '0.8em' }} />
                </motion.div>
                <span>ER</span>
              </motion.div>
            </div>
          </div>

          {/* Line 3 */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'center', position: 'relative', flexWrap: 'wrap' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="brutal-badge hide-mobile"
              style={{ 
                position: 'absolute', 
                top: '15%', 
                right: '-10%',
              }}
            >
              <Zap size={14} />
              <span>ATS Check</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="brutal-badge hide-mobile"
              style={{ 
                position: 'absolute', 
                bottom: '25%', 
                left: '-15%',
                background: 'var(--accent-pink)'
              }}
            >
              <Mic size={14} />
              <span>Interview</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-massive"
            >
              APPLY
            </motion.div>
            <motion.p
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textAlign: 'left',
                maxWidth: '200px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}
            >
              Open to students, professionals, and anyone seeking career growth.
            </motion.p>
          </div>
        </div>

        <div className="hero-bottom-bar" style={{ maxWidth: 1680, width: '100%', margin: '0 auto', padding: '0 24px', marginTop: '96px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} className="hide-mobile" />
            <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.3em', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              ALL-IN-ONE AI PLATFORM — {currentYear}
            </div>
            <Link to="/signup" className="resume-button-group">
              <motion.div className="resume-button">
                <span className="resume-button-text">
                  Get Started
                </span>
                <div className="resume-button-icon">
                  <ArrowDownRight size={20} />
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </main>

      {/* Stats */}
      <section className="stats-section" id="stats">
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px', padding: '60px 24px', maxWidth: '1280px', margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="stat-item"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              style={{ textAlign: 'center' }}
            >
              <h3 className="text-primary" style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.05em' }}>{stat.value}</h3>
              <p style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', marginTop: '8px' }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features" style={{ padding: '120px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          style={{ marginBottom: '64px', maxWidth: '600px' }}
        >
          <h2 style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, marginBottom: '24px' }}>
            Everything You Need to Succeed.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', lineHeight: 1.6 }}>
            Powerful AI tools designed to give you an edge in your job search, without the heavy interface.
          </p>
        </motion.div>

        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {features.map((f, i) => (
            <TiltFeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          © {currentYear} <span className="text-primary" style={{ fontWeight: 900 }}>Smart Apply</span>. Built for students, by developers who care.
        </p>
      </footer>
    </div>
  );
}
