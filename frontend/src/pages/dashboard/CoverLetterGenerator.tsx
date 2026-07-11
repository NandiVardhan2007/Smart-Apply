import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, ArrowRight, X, Copy, Check } from 'lucide-react';
import Editor from '@monaco-editor/react';

import { apiFetch, apiErrorMessage } from '../../api/client';
import { useToast } from '../../components/Toast';
import { PageLoader, ButtonSpinner } from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import type { Resume } from '../../api/types';

function resumeDisplayName(filename: string): string {
  return /^[0-9a-fA-F]{24}\.?.*?$/.test(filename) ? 'Resume document.pdf' : filename;
}

export default function CoverLetterGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      const res = await apiFetch<{ resumes: Resume[] }>('/resumes');
      if (res.ok) setResumes(res.data.resumes || []);
    })();
  }, []);

  const acceptFile = (f: File) => {
    if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
      setFile(f);
      setSelectedResumeId('new');
    } else {
      showToast('error', 'Please upload a PDF file.');
    }
  };

  const handleGenerate = async () => {
    if (!file && !selectedResumeId) {
      showToast('error', 'Please select or upload a resume.');
      return;
    }
    if (!jobDescription.trim()) {
      showToast('error', 'Please provide a job description.');
      return;
    }

    setGenerating(true);
    setCoverLetter('');

    try {
      const formData = new FormData();
      if (selectedResumeId && selectedResumeId !== 'new') {
        formData.append('resume_id', selectedResumeId);
      } else if (file) {
        formData.append('resume_file', file);
      }
      formData.append('job_description', jobDescription);

      const res = await apiFetch<{ cover_letter: string }>('/cover-letter/generate', { method: 'POST', body: formData });

      if (res.ok) {
        setCoverLetter(res.data.cover_letter);
        showToast('success', 'Cover letter generated!');
      } else {
        showToast('error', apiErrorMessage(res, 'Failed to generate cover letter.'));
      }
    } catch {
      showToast('error', 'Network error while generating.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!coverLetter) return;
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('success', 'Copied to clipboard');
  };

  return (
    <div className="container">
      <PageHeader title="Cover Letter Generator" subtitle="Instantly craft a personalized cover letter matching your resume to the job." />

      <PageLoader show={generating} title="Drafting your cover letter" subtitle="Analyzing job requirements and matching your skills..." />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: 22, alignItems: 'start' }} className="cl-grid cover-letter-grid">
        {/* Input */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <span className="eyebrow">Step 1 — Base Resume</span>
            {resumes.length > 0 && (
              <select
                className="input-field"
                value={selectedResumeId}
                onChange={(e) => {
                  setSelectedResumeId(e.target.value);
                  if (e.target.value !== 'new') setFile(null);
                }}
                style={{ marginTop: 10, marginBottom: 12 }}
              >
                <option value="">— Choose an uploaded resume —</option>
                {resumes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {resumeDisplayName(r.filename)}
                  </option>
                ))}
                <option value="new">+ Upload a new PDF</option>
              </select>
            )}

            {(!resumes.length || selectedResumeId === 'new') && (
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
                  marginTop: 10,
                  border: `1.5px dashed ${isDragging ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: isDragging ? 'var(--accent-soft)' : 'transparent',
                  borderRadius: 'var(--radius)',
                  padding: 32,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="application/pdf"
                  onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
                />
                <UploadCloud size={28} style={{ color: 'var(--accent)', margin: '0 auto 10px' }} />
                <h3 style={{ fontSize: 14.5, marginBottom: 3 }}>Drag &amp; drop</h3>
                <p className="text-muted" style={{ fontSize: 12.5 }}>or click to browse (PDF only)</p>

                {file && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="chip"
                    style={{ marginTop: 14, display: 'inline-flex' }}
                  >
                    <FileText size={13} /> {file.name}
                    <button onClick={() => setFile(null)} aria-label="Remove file">
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <span className="eyebrow">Step 2 — Job Description</span>
            <textarea
              className="input-field"
              rows={8}
              placeholder="Paste the target job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              style={{ marginTop: 10 }}
            />
          </div>

          <button className="btn btn-primary btn-lg btn-block" onClick={handleGenerate} disabled={generating || (!file && !selectedResumeId) || !jobDescription.trim()}>
            {generating ? (
              <>
                <ButtonSpinner /> Generating...
              </>
            ) : (
              <>
                Generate Cover Letter <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="card" style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {!coverLetter && !generating && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'var(--surface-sunken)',
                    color: 'var(--ink-faint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <FileText size={24} />
                </div>
                <h3 style={{ fontSize: 16, marginBottom: 5 }}>Ready to draft</h3>
                <p className="text-muted" style={{ fontSize: 13.5 }}>Provide your resume and a job description to begin.</p>
              </motion.div>
            )}

            {coverLetter && !generating && (
              <motion.div key="result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>Your Cover Letter</h3>
                  <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                <div style={{ minHeight: 400, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <textarea 
                    value={coverLetter} 
                    readOnly 
                    style={{ width: '100%', height: 100, color: 'red', marginBottom: 10, padding: 10, fontFamily: 'monospace' }} 
                    placeholder="DEBUG: If this is empty, the state is empty." 
                  />
                  <Editor
                    height="400px"
                    defaultLanguage="markdown"
                    value={coverLetter}
                    onChange={(val) => setCoverLetter(val || '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      wordWrap: 'on',
                      lineNumbers: 'off',
                      padding: { top: 16, bottom: 16 },
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
                <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
                  Feel free to edit the text directly in the editor above before copying it.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cl-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
