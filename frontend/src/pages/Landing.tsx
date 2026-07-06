import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanSearch, Wand2, MessageSquareText, Lightbulb, Video, ArrowRight, Check } from 'lucide-react';

import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'ATS checker',
    description: 'Score your resume against any job description and see exactly which keywords are missing.',
  },
  {
    icon: Wand2,
    title: 'Resume tailoring',
    description: 'Extract your resume into LaTeX, HTML, or a visual editor — then edit and re-export in seconds.',
  },
  {
    icon: MessageSquareText,
    title: 'AI career chat',
    description: 'Get cover letters, interview answers, and salary negotiation advice from an advisor that knows your profile.',
  },
  {
    icon: Lightbulb,
    title: 'Project recommendations',
    description: 'Get project ideas matched to your skills and time, complete with a phased build roadmap.',
  },
  {
    icon: Video,
    title: 'Live interview practice',
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

  return (
    <div>
      <Navbar />

      {/* Hero */}
      <section className="container" style={{ padding: '88px 24px 72px', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="badge badge-accent" style={{ marginBottom: 22 }}>
            AI-powered job search
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', lineHeight: 1.1, maxWidth: 760, margin: '0 auto 20px' }}>
            Land your next role with an AI co-pilot for every step
          </h1>
          <p className="text-muted" style={{ fontSize: 17, maxWidth: 560, margin: '0 auto 34px', lineHeight: 1.6 }}>
            Smart Apply tailors your resume, scores it against real job descriptions, and rehearses interviews with you —
            so you walk in prepared.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}>
              {isAuthenticated ? 'Go to dashboard' : 'Get started free'} <ArrowRight size={17} />
            </button>
            <a href="#features" className="btn btn-secondary btn-lg">
              See how it works
            </a>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="container" style={{ padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="eyebrow">Everything you need</span>
          <h2 style={{ fontSize: 30, marginTop: 8 }}>One platform, the entire job search</h2>
        </div>

        <div className="grid-auto-fit">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="card"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <feature.icon size={20} />
              </div>
              <h3 style={{ fontSize: 16.5, marginBottom: 8 }}>{feature.title}</h3>
              <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="container" style={{ padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="eyebrow">Simple by design</span>
          <h2 style={{ fontSize: 30, marginTop: 8 }}>Three steps to your next offer</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="stat-number" style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 12 }}>{step.n}</div>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{step.title}</h3>
              <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container" style={{ padding: '64px 24px 96px' }}>
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '56px 32px',
            background: 'var(--ink)',
            borderColor: 'var(--ink)',
          }}
        >
          <h2 style={{ fontSize: 28, color: '#fff', marginBottom: 14 }}>Ready to apply smarter?</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14.5, marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
            Create your free account and get your first ATS score in minutes.
          </p>
          <button className="btn btn-lg" style={{ background: '#fff', color: 'var(--ink)' }} onClick={() => navigate('/signup')}>
            Get started free <ArrowRight size={17} />
          </button>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            {['No credit card required', 'Free forever plan', 'Cancel anytime'].map((item) => (
              <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: 12.5 }}>
                <Check size={13} /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 22 }} />
          <p className="text-faint" style={{ fontSize: 12.5 }}>© {new Date().getFullYear()} Smart Apply. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
