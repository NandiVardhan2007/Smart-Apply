import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  Sparkles,
  Lightbulb,
  Copy,
  Check,
  Download,
  ArrowRight,
  ChevronLeft,
  Layers,
  Cpu,
  Code2,
  Terminal,
  FileText,
  RefreshCw,
  Sliders,
  HelpCircle,
  History,
  Box,
  Layers3,
  Bot,
  Zap,
  BookOpen
} from 'lucide-react';

import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
  purpose: string;
}

interface IdeaAnalysis {
  refined_title: string;
  one_liner: string;
  category: string;
  estimated_complexity: number;
  suggested_stack: string[];
  initial_analysis: string;
  clarifying_questions: ClarificationQuestion[];
}

interface ArchitectureSummary {
  title?: string;
  key_features?: string[];
  recommended_stack?: string[];
  database_entities?: string[];
  primary_api_routes?: string[];
  ui_pages?: string[];
}

interface MasterPromptResult {
  prompt_title: string;
  target_format: string;
  master_prompt: string;
  suggested_filename: string;
  architecture_summary: ArchitectureSummary;
}

interface SavedIdea {
  id: string;
  timestamp: string;
  title: string;
  raw_idea: string;
  target_format: string;
  result: MasterPromptResult;
}

const STARTER_IDEAS = [
  {
    title: '🐶 PetCare Trade & Services',
    raw: 'An app for dog and cat owners in the neighborhood to trade pet food, book trusted pet sitters, share medical records, and ask AI vet questions.',
    tag: 'Marketplace'
  },
  {
    title: '🎓 AI Code Tutor with Live Voice',
    raw: 'An interactive web app where beginners paste broken code and a conversational AI voice tutor guides them step by step without giving direct answers.',
    tag: 'EdTech AI'
  },
  {
    title: '💰 Subscription & Micro-SaaS Audit',
    raw: 'A dashboard that syncs user credit card statements, detects forgotten recurring subscriptions, predicts monthly burn rate, and auto-cancels unneeded services.',
    tag: 'FinTech'
  },
  {
    title: '⚡ Instant Resume & Portfolio Builder',
    raw: 'A platform where developers input a GitHub username or LinkedIn URL, and AI auto-generates a hosted interactive 3D portfolio website and ATS resume.',
    tag: 'Developer Tool'
  }
];

const TARGET_FORMATS = [
  {
    id: 'cursor',
    name: 'Cursor & Windsurf Rules',
    icon: Terminal,
    desc: 'Optimized .cursorrules / System rules for AI coding agents',
    color: '#38bdf8'
  },
  {
    id: 'v0',
    name: 'v0 & Bolt.new UI Prompt',
    icon: Code2,
    desc: 'UI/UX layout, component specs & theme token design prompt',
    color: '#10b981'
  },
  {
    id: 'claude',
    name: 'Claude 3.5 & GPT-4o Master Spec',
    icon: Sparkles,
    desc: 'Comprehensive PRD, User Stories, Schemas & System Prompt',
    color: '#a855f7'
  },
  {
    id: 'architecture',
    name: 'Full-Stack Blueprint',
    icon: Cpu,
    desc: 'End-to-End Technical Architecture, API Spec & Database ERD',
    color: '#f59e0b'
  }
];

const LOADING_MESSAGES_STEP1 = [
  'Decoding your raw concept & extracting core features...',
  'Analyzing product domain & identifying technical scope...',
  'Formulating strategic clarifying questions to eliminate doubts...',
  'Architecting initial technology stack recommendations...'
];

const LOADING_MESSAGES_STEP2 = [
  'Synthesizing your decisions into a Master AI Prompt...',
  'Structuring database entities & API route contracts...',
  'Enforcing coding guidelines & architecture rules...',
  'Generating production-grade AI prompt blueprint...'
];

function LoadingView({ messages }: { messages: string[] }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '3px solid var(--accent-soft-border)',
            borderTopColor: 'var(--accent)',
          }}
        />
        <Wand2
          size={26}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--accent)' }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.h3
          key={msgIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}
        >
          {messages[msgIndex]}
        </motion.h3>
      </AnimatePresence>
      <p style={{ color: 'var(--ink-faint)', fontSize: '13px', marginTop: '8px' }}>
        Antigravity AI is refining your idea into a production specification
      </p>
    </div>
  );
}

export default function IdeaPromptGenerator() {
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // User Inputs
  const [rawIdea, setRawIdea] = useState('');
  const [targetFormat, setTargetFormat] = useState('cursor');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Results
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null);
  const [result, setResult] = useState<MasterPromptResult | null>(null);

  // Active Output Tab
  const [outputTab, setOutputTab] = useState<'prompt' | 'architecture'>('prompt');
  const [copied, setCopied] = useState(false);

  // Refining Prompt
  const [tweakInput, setTweakInput] = useState('');
  const [isTweaking, setIsTweaking] = useState(false);

  // Saved Ideas History
  const [history, setHistory] = useState<SavedIdea[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('smart_apply_idea_prompts_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveToHistory = (item: MasterPromptResult, idea: string, format: string) => {
    const newEntry: SavedIdea = {
      id: String(Date.now()),
      timestamp: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      title: item.architecture_summary?.title || item.prompt_title || 'Refined Idea',
      raw_idea: idea,
      target_format: format,
      result: item
    };
    const updated = [newEntry, ...history.filter(h => h.title !== newEntry.title)].slice(0, 15);
    setHistory(updated);
    localStorage.setItem('smart_apply_idea_prompts_history', JSON.stringify(updated));
  };

  // Step 1: Submit raw idea for AI clarification analysis
  const handleAnalyzeIdea = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawIdea.trim()) {
      showToast('error', 'Please describe your project idea first.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<IdeaAnalysis>('/ai/idea/analyze', {
        method: 'POST',
        body: JSON.stringify({ raw_idea: rawIdea, target_format: targetFormat }),
      });

      if (res.ok && res.data) {
        setAnalysis(res.data);
        // Pre-fill default answers if available
        const defaultAnswers: Record<string, string> = {};
        res.data.clarifying_questions?.forEach((q) => {
          if (q.options && q.options.length > 0) {
            defaultAnswers[q.id] = q.options[0];
          }
        });
        setAnswers(defaultAnswers);
        setStep(2);
      } else {
        showToast('error', 'Failed to analyze idea. Please try again.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Network error while contacting AI.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Generate Master AI Prompt using answers
  const handleGeneratePrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setLoading(true);
    try {
      const res = await apiFetch<MasterPromptResult>('/ai/idea/generate-prompt', {
        method: 'POST',
        body: JSON.stringify({
          raw_idea: rawIdea,
          refined_title: analysis?.refined_title || '',
          target_format: targetFormat,
          clarification_answers: answers,
          additional_notes: additionalNotes
        }),
      });

      if (res.ok && res.data) {
        setResult(res.data);
        saveToHistory(res.data, rawIdea, targetFormat);
        setStep(3);
        showToast('success', 'Master AI Prompt generated successfully!');
      } else {
        showToast('error', 'Failed to generate Master Prompt.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error generating prompt.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Dynamic Prompt Tweak
  const handleTweakPrompt = async () => {
    if (!tweakInput.trim() || !result) return;
    setIsTweaking(true);
    try {
      const res = await apiFetch<MasterPromptResult>('/ai/idea/generate-prompt', {
        method: 'POST',
        body: JSON.stringify({
          raw_idea: rawIdea,
          refined_title: analysis?.refined_title || '',
          target_format: targetFormat,
          clarification_answers: answers,
          additional_notes: `Previous Prompt Generated. User wants this tweak: ${tweakInput.trim()}`
        }),
      });

      if (res.ok && res.data) {
        setResult(res.data);
        setTweakInput('');
        showToast('success', 'Prompt updated with your requested tweak!');
      } else {
        showToast('error', 'Failed to tweak prompt.');
      }
    } catch (err) {
      showToast('error', 'Error updating prompt.');
    } finally {
      setIsTweaking(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!result?.master_prompt) return;
    navigator.clipboard.writeText(result.master_prompt);
    setCopied(true);
    showToast('success', 'Master Prompt copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPrompt = () => {
    if (!result?.master_prompt) return;
    const filename = result.suggested_filename || 'MASTER_PROMPT.md';
    const blob = new Blob([result.master_prompt], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Downloaded ${filename}`);
  };

  return (
    <div className="container-narrow" style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div className="dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '16px', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
            <Wand2 size={14} /> AI IDEA TO PROMPT STUDIO
          </div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Unstructured Idea Prompt Generator</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: '14px' }}>
            Turn vague, raw, or doubtful app ideas into production-ready AI Master Prompts &amp; Specs.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <History size={15} /> Saved Ideas ({history.length})
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* STAGE 1: RAW IDEA INPUT */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="card">
            {loading ? (
              <LoadingView messages={LOADING_MESSAGES_STEP1} />
            ) : (
              <form onSubmit={handleAnalyzeIdea} className="flex flex-col gap-6">
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
                    Describe your project idea in raw, unstructured words:
                  </label>
                  <textarea
                    className="input-field"
                    rows={5}
                    placeholder="e.g. I want to make an app for college students to share notes and get auto-generated flashcards using AI with voice audio summaries..."
                    value={rawIdea}
                    onChange={(e) => setRawIdea(e.target.value)}
                    style={{ fontSize: '14px', lineHeight: 1.6 }}
                    required
                  />
                </div>

                {/* Target Prompt Format Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '10px' }}>
                    Select Output AI Target Format:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    {TARGET_FORMATS.map((fmt) => {
                      const Icon = fmt.icon;
                      const isSelected = targetFormat === fmt.id;
                      return (
                        <div
                          key={fmt.id}
                          onClick={() => setTargetFormat(fmt.id)}
                          style={{
                            padding: '14px',
                            borderRadius: 'var(--radius)',
                            border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <Icon size={18} color={isSelected ? 'var(--accent)' : 'var(--ink-soft)'} />
                            <strong style={{ fontSize: '14px', color: isSelected ? 'var(--accent)' : 'var(--ink)' }}>{fmt.name}</strong>
                          </div>
                          <p style={{ margin: 0, fontSize: '11px', color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                            {fmt.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Starter Ideas */}
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                    <Lightbulb size={13} color="var(--accent)" /> NEED INSPIRATION? CLICK A STARTER IDEA:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {STARTER_IDEAS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRawIdea(item.raw);
                          showToast('info', `Loaded idea starter: ${item.title}`);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          background: 'var(--surface-sunken)',
                          border: '1px solid var(--border)',
                          fontSize: '12px',
                          color: 'var(--ink-soft)',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg mt-2"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={loading}
                >
                  Analyze &amp; Resolve Doubts <ArrowRight size={18} />
                </button>
              </form>
            )}
          </motion.div>
        )}

        {/* STAGE 2: AI CLARIFICATION & DOUBT RESOLVER */}
        {step === 2 && analysis && (
          <motion.div key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            {loading ? (
              <div className="card">
                <LoadingView messages={LOADING_MESSAGES_STEP2} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)} style={{ alignSelf: 'flex-start' }}>
                  <ChevronLeft size={15} /> Back to Idea Input
                </button>

                {/* Initial AI Idea Analysis Banner */}
                <div className="card" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span className="eyebrow" style={{ color: 'var(--accent)' }}>AI Concept Evaluation</span>
                      <h2 style={{ fontSize: '22px', margin: '4px 0 6px', color: 'var(--ink)' }}>{analysis.refined_title}</h2>
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-soft)' }}>"{analysis.one_liner}"</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge badge-accent" style={{ fontSize: '12px' }}>
                        Category: {analysis.category}
                      </span>
                      <span className="badge" style={{ fontSize: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        Complexity: {analysis.estimated_complexity}/10
                      </span>
                    </div>
                  </div>

                  <p style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--accent-soft-border)', fontSize: '13px', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                    <strong>Architectural Note:</strong> {analysis.initial_analysis}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-faint)' }}>SUGGESTED STACK:</span>
                    {analysis.suggested_stack?.map((tech) => (
                      <span key={tech} className="badge badge-accent" style={{ fontSize: '11px' }}>
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Clarifying Questions Form */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <HelpCircle size={20} color="var(--accent)" />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--ink)' }}>Resolve Architectural Doubts</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-soft)' }}>
                        Select preferences to tailor your final AI Master Prompt
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleGeneratePrompt} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {analysis.clarifying_questions?.map((q, idx) => (
                      <div key={q.id} style={{ background: 'var(--surface-sunken)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                            QUESTION {idx + 1} — {q.purpose}
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--ink)', fontWeight: 600 }}>
                          {q.question}
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {q.options?.map((opt) => {
                            const isSelected = answers[q.id] === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                  background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                                  color: isSelected ? 'var(--accent)' : 'var(--ink-soft)',
                                  fontSize: '12px',
                                  fontWeight: isSelected ? 600 : 400,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <span>{opt}</span>
                                {isSelected && <Check size={14} color="var(--accent)" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="input-group">
                      <label style={{ fontWeight: 600, fontSize: '13px' }}>Additional Specific Rules or Constraints (Optional):</label>
                      <textarea
                        className="input-field"
                        rows={2}
                        placeholder="e.g. Must include dark mode support, use Zustand for state management, include Stripe webhook handling..."
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                        Generate Master AI Prompt <Wand2 size={18} />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STAGE 3: MASTER PROMPT & BLUEPRINT OUTPUT */}
        {step === 3 && result && (
          <motion.div key="step3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setStep(2)}>
                  <ChevronLeft size={15} /> Back to Decisions
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleCopyPrompt} className="btn btn-primary btn-sm">
                    {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied!' : 'Copy Prompt'}
                  </button>

                  <button onClick={handleDownloadPrompt} className="btn btn-secondary btn-sm">
                    <Download size={15} /> Download ({result.suggested_filename})
                  </button>
                </div>
              </div>

              {/* Title & Target format banner */}
              <div className="card" style={{ background: 'var(--surface)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="eyebrow" style={{ color: 'var(--accent)' }}>Master Specification Ready</span>
                    <h2 style={{ margin: '4px 0 0', fontSize: '20px' }}>{result.prompt_title}</h2>
                  </div>

                  {/* Tab Navigation */}
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-sunken)', padding: '3px', borderRadius: 'var(--radius)' }}>
                    <button
                      onClick={() => setOutputTab('prompt')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: outputTab === 'prompt' ? 'var(--accent)' : 'transparent',
                        color: outputTab === 'prompt' ? 'var(--accent-ink)' : 'var(--ink-soft)',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Terminal size={14} /> Master Prompt Code
                    </button>
                    <button
                      onClick={() => setOutputTab('architecture')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: outputTab === 'architecture' ? 'var(--accent)' : 'transparent',
                        color: outputTab === 'architecture' ? 'var(--accent-ink)' : 'var(--ink-soft)',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Box size={14} /> System Architecture Spec
                    </button>
                  </div>
                </div>
              </div>

              {/* Output Content */}
              {outputTab === 'prompt' ? (
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)', fontWeight: 600 }}>
                      FILE: {result.suggested_filename} | FORMAT: {result.target_format.toUpperCase()}
                    </span>
                    <button onClick={handleCopyPrompt} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} Copy
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '16px',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      color: 'var(--ink)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      maxHeight: '520px',
                      overflowY: 'auto',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {result.master_prompt}
                  </pre>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Key Features */}
                  <div className="card">
                    <h3 style={{ fontSize: '15px', marginTop: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={16} /> Key Product Features
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--ink-soft)' }}>
                      {result.architecture_summary?.key_features?.map((feat, i) => (
                        <li key={i}>{feat}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommended Stack */}
                  <div className="card">
                    <h3 style={{ fontSize: '15px', marginTop: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Cpu size={16} /> Technical Stack Blueprint
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {result.architecture_summary?.recommended_stack?.map((item, i) => (
                        <span key={i} className="badge badge-accent">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Database Entities */}
                  <div className="card">
                    <h3 style={{ fontSize: '15px', marginTop: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers3 size={16} /> Core Database Entities
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {result.architecture_summary?.database_entities?.map((ent, i) => (
                        <span key={i} className="badge" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}>
                          {ent}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Primary API Routes */}
                  <div className="card">
                    <h3 style={{ fontSize: '15px', marginTop: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={16} /> Primary REST API Endpoints
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                      {result.architecture_summary?.primary_api_routes?.map((route, i) => (
                        <li key={i}>{route}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Dynamic Prompt Tweaker Box */}
              <div className="card" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={15} color="var(--accent)" /> Want to Tweak or Refine this Prompt?
                </h4>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--ink-soft)' }}>
                  Ask AI to add or modify rules (e.g., "Add Firebase Auth", "Enforce Tailwind v4 styles", "Add dark mode toggle").
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Add Docker compose configuration and Redis caching rules..."
                    value={tweakInput}
                    onChange={(e) => setTweakInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTweakPrompt()}
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={handleTweakPrompt}
                    disabled={isTweaking || !tweakInput.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {isTweaking ? 'Updating...' : 'Tweak Prompt'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Drawer Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <History size={18} color="var(--accent)" /> Saved Idea Prompts History
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="btn-ghost" style={{ cursor: 'pointer', padding: '4px' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface-sunken)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: '14px', color: 'var(--ink)' }}>{h.title}</h4>
                    <span style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>{h.timestamp} • Format: {h.target_format.toUpperCase()}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        setResult(h.result);
                        setRawIdea(h.raw_idea);
                        setTargetFormat(h.target_format);
                        setStep(3);
                        setShowHistoryModal(false);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      Load Prompt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
