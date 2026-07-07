import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, ArrowRight, X } from 'lucide-react';
import { FiLinkedin as Linkedin } from 'react-icons/fi';
import { apiFetch, apiErrorMessage } from '../../api/client';
import { useToast } from '../../components/Toast';
import { PageLoader, ButtonSpinner } from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';

interface OptimizationResult {
  headline_suggestions: string[];
  summary_rewrite: string;
  experience_improvements: { role: string; suggestion: string }[];
}

export default function LinkedInOptimizer() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const acceptFile = (f: File) => {
    if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
      setFile(f);
      setResult(null); // Reset previous results on new upload
    } else {
      showToast('error', 'Please upload a PDF file.');
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      showToast('error', 'Please upload a PDF of your LinkedIn profile.');
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('profile_file', file);

      const res = await apiFetch<OptimizationResult>('/linkedin/optimize', { 
        method: 'POST', 
        body: formData 
      });

      if (res.ok) {
        setResult(res.data);
        showToast('success', 'Profile analyzed successfully!');
      } else {
        showToast('error', apiErrorMessage(res, 'Failed to analyze profile.'));
      }
    } catch {
      showToast('error', 'Network error while analyzing.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="container">
      <PageHeader 
        title="LinkedIn Profile Optimizer" 
        subtitle="Upload a PDF export of your LinkedIn profile to get AI-driven optimization suggestions." 
      />

      <PageLoader 
        show={analyzing} 
        title="Analyzing your profile" 
        subtitle="Our AI is reading your experience and crafting improvements..." 
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 24, alignItems: 'start' }} className="linkedin-grid">
        {/* Input Pane */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Linkedin size={16} /> Upload Profile PDF
            </span>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) acceptFile(e.dataTransfer.files[0]);
              }}
              style={{
                marginTop: 12,
                border: `1.5px dashed ${isDragging ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: isDragging ? 'var(--accent-soft)' : 'transparent',
                borderRadius: 'var(--radius)',
                padding: '30px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="application/pdf"
                onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
              />
              <UploadCloud size={24} style={{ color: 'var(--accent)', margin: '0 auto 8px' }} />
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>Drag &amp; drop PDF</h3>
              <p className="text-muted" style={{ fontSize: 13 }}>or click to browse</p>

              {file && (
                <div onClick={(e) => e.stopPropagation()} className="chip" style={{ marginTop: 16, display: 'inline-flex' }}>
                  <FileText size={14} /> {file.name}
                  <button onClick={() => setFile(null)} aria-label="Remove file" style={{ marginLeft: 6 }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button 
            className="btn btn-primary btn-lg btn-block" 
            onClick={handleAnalyze} 
            disabled={analyzing || !file}
          >
            {analyzing ? (
              <><ButtonSpinner /> Analyzing...</>
            ) : (
              <>Optimize Profile <ArrowRight size={18} /></>
            )}
          </button>
        </div>

        {/* Results Pane */}
        <div className="card" style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {!result && !analyzing && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-sunken)', color: 'var(--ink-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                }}>
                  <Linkedin size={32} />
                </div>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>Awaiting Profile</h3>
                <p className="text-muted" style={{ fontSize: 14, maxWidth: 300 }}>Upload your LinkedIn PDF to receive tailored headline, summary, and experience optimizations.</p>
              </motion.div>
            )}

            {result && !analyzing && (
              <motion.div 
                key="result" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
              >
                <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>Headline Suggestions</h3>
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.headline_suggestions.map((suggestion, idx) => (
                      <li key={idx} style={{ fontSize: 14.5, color: 'var(--ink)' }}>{suggestion}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>About / Summary Rewrite</h3>
                  <div style={{ padding: 16, background: 'var(--surface-sunken)', borderRadius: 'var(--radius)', fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {result.summary_rewrite}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)', marginBottom: 16 }}>Experience Improvements</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {result.experience_improvements.length > 0 ? (
                      result.experience_improvements.map((exp, idx) => (
                        <div key={idx} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                          <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{exp.role}</h4>
                          <p style={{ fontSize: 14, color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.5 }}>
                            {exp.suggestion}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted" style={{ fontSize: 14 }}>No specific experience improvements found.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .linkedin-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
