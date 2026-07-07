import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, Server, Layout, Database, Cpu, Boxes, Wrench,
  MessageSquare, X, ChevronRight, Loader2,
  Smile, FlaskConical, BarChart3, Rocket, Building2, GraduationCap,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

export interface InterviewConfig {
  interviewType: string;
  customType: string;
  jobDescription: string;
  persona: string;
}

export interface InterviewConfigModalProps {
  onStart: (config: InterviewConfig) => void;
  modelsLoaded: boolean;
  isConnecting: boolean;
}

/* ────────────────────────────────────────────────────────────
 * Data
 * ──────────────────────────────────────────────────────────── */

const INTERVIEW_TYPES = [
  { value: 'behavioral',  label: 'Behavioral',         icon: MessageSquare, desc: 'Leadership, teamwork, conflict resolution' },
  { value: 'react',       label: 'React Frontend',     icon: Layout,        desc: 'Hooks, state management, component design' },
  { value: 'fullstack',   label: 'Full Stack',         icon: Boxes,         desc: 'End-to-end architecture & implementation' },
  { value: 'backend',     label: 'Backend',            icon: Server,        desc: 'APIs, databases, system internals' },
  { value: 'system',      label: 'System Design',      icon: Database,      desc: 'Scalability, distributed systems, trade-offs' },
  { value: 'dsa',         label: 'DSA',                icon: Cpu,           desc: 'Data structures & algorithms' },
  { value: 'machine',     label: 'Machine Coding',     icon: Code2,         desc: 'Build a working solution under time pressure' },
  { value: 'custom',      label: 'Custom',             icon: Wrench,        desc: 'Specify your own focus area' },
] as const;

const PERSONAS = [
  { value: 'friendly_hr',    label: 'Friendly HR Manager',       icon: Smile,        desc: 'Warm, encouraging, focuses on culture fit' },
  { value: 'strict_tech',    label: 'Strict Technical Lead',     icon: FlaskConical, desc: 'Rigorous, expects precise answers' },
  { value: 'senior_em',      label: 'Senior Eng. Manager',       icon: BarChart3,    desc: 'Balanced between technical depth & leadership' },
  { value: 'startup',        label: 'Startup Founder',           icon: Rocket,       desc: 'Fast-paced, values scrappiness & initiative' },
  { value: 'faang',          label: 'FAANG Interviewer',         icon: Building2,    desc: 'Structured, bar-raiser style questioning' },
  { value: 'mentor',         label: 'Supportive Mentor',         icon: GraduationCap, desc: 'Guides you through with hints & encouragement' },
] as const;

/* ────────────────────────────────────────────────────────────
 * Reusable selection card
 * ──────────────────────────────────────────────────────────── */

function SelectCard(
  { label, desc, icon: Icon, selected, onClick }:
  { label: string; desc: string; icon: typeof Code2; selected: boolean; onClick: () => void }
) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? 'var(--accent-soft)' : 'var(--surface)',
        border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        transition: 'border-color 150ms ease, background 150ms ease, transform 80ms ease',
        width: '100%',
      }}
      onMouseDown={(e) => {
        const el = e.currentTarget;
        el.style.transform = 'scale(0.98)';
        requestAnimationFrame(() => { el.style.transform = ''; });
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          background: selected ? 'var(--accent)' : 'var(--surface-sunken)',
          color: selected ? 'var(--accent-ink)' : 'var(--ink-faint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 150ms ease, color 150ms ease',
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: selected ? 'var(--accent)' : 'var(--ink)', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.4 }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────
 * Main modal
 * ──────────────────────────────────────────────────────────── */

export default function InterviewConfigModal({ onStart, modelsLoaded, isConnecting }: InterviewConfigModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [interviewType, setInterviewType] = useState('');
  const [customType, setCustomType] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [persona, setPersona] = useState('');

  const canProceedStep1 = interviewType !== '' && (interviewType !== 'custom' || customType.trim() !== '');
  const canProceedStep2 = true; // JD is optional
  const canStart = persona !== '' && modelsLoaded;

  const handleStart = useCallback(() => {
    if (!canStart) return;
    onStart({ interviewType, customType, jobDescription, persona });
  }, [canStart, onStart, interviewType, customType, jobDescription, persona]);

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="card"
        style={{ maxWidth: 640, width: '100%', padding: 0, overflow: 'hidden' }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Configure Your Interview</h2>
            <p className="text-muted" style={{ fontSize: 13.5 }}>
              Step {step} of 3 — {step === 1 ? 'Interview Type' : step === 2 ? 'Job Description' : 'Interviewer Persona'}
            </p>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  width: s === step ? 24 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: s <= step ? 'var(--accent)' : 'var(--border-strong)',
                  transition: 'all 200ms ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '24px 28px', minHeight: 320, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 10,
                  }}
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <SelectCard
                      key={t.value}
                      label={t.label}
                      desc={t.desc}
                      icon={t.icon}
                      selected={interviewType === t.value}
                      onClick={() => setInterviewType(t.value)}
                    />
                  ))}
                </div>

                {interviewType === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ marginTop: 14 }}
                  >
                    <input
                      className="input-field"
                      placeholder="e.g., GraphQL API design, Mobile development, ML systems…"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      autoFocus
                    />
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.6 }}>
                  Paste the job description below and the AI will tailor its questions, evaluation criteria,
                  and feedback to match. <span style={{ color: 'var(--ink-faint)' }}>This step is optional.</span>
                </p>
                <textarea
                  className="input-field"
                  rows={10}
                  placeholder="Paste the complete job description here for a tailored interview experience…"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  style={{ resize: 'vertical', lineHeight: 1.55, fontFamily: 'var(--font-sans)' }}
                />
                {jobDescription.trim() && (
                  <p style={{ marginTop: 8, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ✓ Job description attached ({jobDescription.trim().split(/\s+/).length} words)
                  </p>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 10,
                  }}
                >
                  {PERSONAS.map((p) => (
                    <SelectCard
                      key={p.value}
                      label={p.label}
                      desc={p.desc}
                      icon={p.icon}
                      selected={persona === p.value}
                      onClick={() => setPersona(p.value)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
            style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
          >
            ← Back
          </button>

          {step < 3 ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)}
              disabled={step === 1 && !canProceedStep1}
              style={{ gap: 6 }}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!canStart || isConnecting}
              style={{ gap: 8, padding: '12px 28px' }}
            >
              {isConnecting ? (
                <><Loader2 size={16} className="spin" /> Connecting…</>
              ) : !modelsLoaded ? (
                <><Loader2 size={16} className="spin" /> Loading AI models…</>
              ) : (
                <>Start Interview <ChevronRight size={16} /></>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
