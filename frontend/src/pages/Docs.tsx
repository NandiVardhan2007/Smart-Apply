import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Layers,
  Cpu,
  Database,
  Users,
  TrendingUp,
  Terminal,
  Rocket,
  Search,
  ArrowLeft,
  Check,
  Shield,
  Zap,
  Code,
  FileText,
  Video,
  Sparkles,
  Server,
  Globe,
  Lock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeSwitcher from '../components/ThemeSwitcher';

const SECTIONS = [
  { id: 'overview', title: '1. Overview & Core Features', icon: BookOpen },
  { id: 'audience', title: '2. Target Audience', icon: Users },
  { id: 'userbase', title: '3. Estimated Userbase & Growth', icon: TrendingUp },
  { id: 'architecture', title: '4. System Architecture', icon: Layers },
  { id: 'systemdesign', title: '5. System Design & Workflows', icon: Cpu },
  { id: 'datamodels', title: '6. Data Models & Schemas', icon: Database },
  { id: 'setup', title: '7. Getting Started & Setup', icon: Terminal },
  { id: 'deployment', title: '8. Deployment Architecture', icon: Server },
  { id: 'futurescope', title: '9. Future Scope & Roadmap', icon: Rocket },
];

export default function Docs() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = SECTIONS.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', color: 'var(--ink)' }}>
      {/* Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--surface-card-blur, rgba(15, 23, 42, 0.85))',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '16px 24px',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <div style={{ height: 20, width: 1, background: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/small_logo.svg" alt="Smart Apply" style={{ height: 26 }} />
              <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                SmartApply Docs
              </span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>
                v1.0
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', width: 240 }} className="desktop-search">
              <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--ink-muted)' }} />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 34px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  fontSize: 13,
                }}
              />
            </div>
            <ThemeSwitcher variant="compact" />
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Container */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px', display: 'flex', gap: 32 }}>
        {/* Sidebar Nav */}
        <aside style={{ width: 280, flexShrink: 0 }} className="docs-sidebar">
          <div style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eyebrow" style={{ paddingLeft: 12, marginBottom: 4 }}>
              Table of Contents
            </span>
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveSection(sec.id);
                    document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--ink-muted)',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} />
                  <span>{sec.title.replace(/^\d+\.\s*/, '')}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Doc Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 48 }}
          >
            {/* Section 1: Overview */}
            <section id="overview" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <BookOpen size={24} style={{ color: 'var(--accent)' }} />
                <h1 style={{ fontSize: 24, margin: 0 }}>1. Overview & Core Features</h1>
              </div>
              <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6, fontSize: 15 }}>
                SmartApply is an end-to-end AI-powered career companion and job application platform. It combines automated resume tailoring, ATS compatibility scoring, real-time voice AI mock interviews with live code execution sandboxing, facial expression telemetry, project recommendations, and AI career coaching.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 24 }}>
                <div style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>
                    <Sparkles size={18} /> AI Resume Tailor
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>Automatically adapts resumes to job descriptions by optimizing ATS keyword density.</p>
                </div>

                <div style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>
                    <FileText size={18} /> ATS Compatibility Checker
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>Scores resumes against specific job postings and lists missing key skills.</p>
                </div>

                <div style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>
                    <Video size={18} /> Live Voice Interview Studio
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>Real-time voice AI interview practice with Judge0 sandboxed coding & vision HUD telemetry.</p>
                </div>

                <div style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>
                    <Code size={18} /> Idea Prompt Studio
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: 0 }}>Converts rough thoughts into buildable portfolio projects with structured AI prompts.</p>
                </div>
              </div>
            </section>

            {/* Section 2: Target Audience */}
            <section id="audience" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Users size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>2. Target Audience</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
                {[
                  { title: 'Software Engineers', desc: 'Need technical ATS alignment & sandboxed coding mock interview practice.' },
                  { title: 'Recent Graduates', desc: 'Require project portfolio recommendations & voice interview confidence building.' },
                  { title: 'Career Switchers', desc: 'Need resume tailoring to highlight transferable skills for new industries.' },
                  { title: 'Senior Job Seekers', desc: 'Managing multiple tailored resume versions across distinct executive roles.' }
                ].map((item, i) => (
                  <div key={i} style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: 15 }}>{item.title}</h4>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: Userbase & Growth */}
            <section id="userbase" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <TrendingUp size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>3. Estimated Userbase & Growth Projections</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { phase: 'Phase 1: Launch (Months 1–6)', users: '5,000 – 15,000 MAUs', focus: 'College campus drives, tech job communities (Reddit, Discord, LinkedIn), bootcamps.' },
                  { phase: 'Phase 2: Community Scale (Months 6–18)', users: '50,000 – 150,000 MAUs', focus: 'University placement cells, bootcamps, and career coaching agency partnerships.' },
                  { phase: 'Phase 3: Global SaaS Scale (Year 2+)', users: '500,000+ MAUs', focus: 'B2B recruiter dashboards, university placement analytics, enterprise licensing.' }
                ].map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.phase}</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--ink-muted)' }}>{p.focus}</p>
                    </div>
                    <span style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {p.users}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4: System Architecture */}
            <section id="architecture" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Layers size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>4. System Architecture</h2>
              </div>
              <p style={{ color: 'var(--ink-muted)', fontSize: 14, marginBottom: 20 }}>
                SmartApply uses a decoupled micro-service architecture designed for high concurrency, low latency streaming, and multi-tab synchronization.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
                  <Globe size={20} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                  <h4 style={{ margin: '0 0 4px 0' }}>Frontend Layer</h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>React 18 + TypeScript + Vite + Framer Motion + WebSpeech API</p>
                </div>
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
                  <Zap size={20} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                  <h4 style={{ margin: '0 0 4px 0' }}>API Service Layer</h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>FastAPI (Python 3.10) + Uvicorn + WebSockets Manager</p>
                </div>
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
                  <Database size={20} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                  <h4 style={{ margin: '0 0 4px 0' }}>Data & Caching</h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>MongoDB Atlas + Beanie ODM + Redis Pub/Sub Session Store</p>
                </div>
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
                  <Cpu size={20} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                  <h4 style={{ margin: '0 0 4px 0' }}>External Execution</h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-muted)' }}>NVIDIA NIM (Llama 3.1 70B) + Judge0 Code Sandbox API</p>
                </div>
              </div>
            </section>

            {/* Section 5: System Design & Workflows */}
            <section id="systemdesign" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Cpu size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>5. System Design & Component Workflows</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 18, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lock size={16} style={{ color: 'var(--accent)' }} /> Multi-Tab Session Sync via Redis Pub/Sub
                  </h4>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                    When a user authenticates or logs out in one tab, `AuthSocketManager` publishes an event to Redis Pub/Sub, immediately syncing state across all open browser tabs via WebSockets.
                  </p>
                </div>

                <div style={{ padding: 18, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} style={{ color: 'var(--accent)' }} /> Resume Processing & Extraction
                  </h4>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                    PDF/DOCX uploads are cleaned with PyPDF2/docx, stored in Cloudflare R2 object storage, and parsed into structured Pydantic models for fast keyword indexing.
                  </p>
                </div>

                <div style={{ padding: 18, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Code size={16} style={{ color: 'var(--accent)' }} /> Live Interview Sandbox Execution
                  </h4>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                    Code written during mock interviews is transmitted via WebSocket API to Judge0 CE engine for secure, sandboxed execution with runtime telemetry.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6: Data Models */}
            <section id="datamodels" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Database size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>6. Data Models & Schemas</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {[
                  { name: 'User Document', collection: 'users', fields: ['email (Unique String)', 'hashed_password (String)', 'skills (List[String])', 'features (Dict[String, Bool])', 'created_at (Datetime)'] },
                  { name: 'Resume Document', collection: 'resumes', fields: ['user_id (PydanticObjectId)', 'filename & file_url', 'extracted_text (String)', 'ats_score (Int)', 'uploaded_at (Datetime)'] },
                  { name: 'Interview Report', collection: 'interview_reports', fields: ['user_id & room_name', 'questions_asked & user_replies', 'telemetry_summary (Dict)', 'final_score (Int 0-100)'] },
                  { name: 'System Settings', collection: 'system_settings', fields: ['maintenance_mode (Bool)', 'max_resumes_per_user (Int)', 'ai_model_default (String)', 'rate_limits (Dict)'] }
                ].map((m, i) => (
                  <div key={i} style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
                    <span className="eyebrow">{m.collection}</span>
                    <h4 style={{ margin: '4px 0 10px 0', fontSize: 16 }}>{m.name}</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {m.fields.map((f, idx) => (
                        <li key={idx}><code>{f}</code></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 7: Getting Started */}
            <section id="setup" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Terminal size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>7. Getting Started & Setup</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>1. Backend Setup (FastAPI + Python 3.10)</span>
                  <pre style={{ margin: '8px 0 0 0', padding: 12, borderRadius: 6, background: 'rgba(0,0,0,0.3)', fontSize: 12.5, overflowX: 'auto' }}>
{`cd backend
python -m venv venv
# Windows: .\\venv\\Scripts\\activate | Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000`}
                  </pre>
                </div>

                <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>2. Frontend Setup (React + Vite)</span>
                  <pre style={{ margin: '8px 0 0 0', padding: 12, borderRadius: 6, background: 'rgba(0,0,0,0.3)', fontSize: 12.5, overflowX: 'auto' }}>
{`cd frontend
npm install
npm run dev`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Section 8: Deployment */}
            <section id="deployment" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Server size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>8. Deployment Architecture</h2>
              </div>
              <p style={{ color: 'var(--ink-muted)', fontSize: 14, margin: 0 }}>
                SmartApply is pre-configured for continuous deployment via <strong>Render</strong> using <code>render.yaml</code>:
              </p>
              <ul style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li><strong>Backend Service:</strong> Deployed as a Python Web Service (<code>uvicorn app.main:app</code>).</li>
                <li><strong>Frontend Static Site:</strong> Built using Vite (<code>dist</code> directory) and served via Render CDN.</li>
                <li><strong>Redis Instance:</strong> Connected internally via high-speed connection string.</li>
              </ul>
            </section>

            {/* Section 9: Future Scope */}
            <section id="futurescope" className="card" style={{ padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Rocket size={24} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: 22, margin: 0 }}>9. Future Scope & Roadmap</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                {[
                  'Multi-Modal Video AI Interviewers (Real-time avatar synthesis)',
                  'Chrome Extension for One-Click LinkedIn & Indeed Resume Tailoring',
                  'University Placement & Recruiter B2B Analytics Dashboards',
                  'Native Mobile App (React Native for iOS & Android)',
                  'Privacy-first Offline Local Model Fallbacks (Ollama / Llama-3.2 3B)'
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    <Check size={16} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </section>

          </motion.div>
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .docs-sidebar { display: none !important; }
          .desktop-search { display: none !important; }
        }
      `}</style>
    </div>
  );
}
