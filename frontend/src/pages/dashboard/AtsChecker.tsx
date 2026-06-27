import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

// Component for animating the score number
function AnimatedScore({ targetScore }: { targetScore: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = targetScore / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= targetScore) {
        setCurrent(targetScore);
        clearInterval(timer);
      } else {
        setCurrent(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [targetScore]);

  return <span className="number">{current}</span>;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
};

export default function AtsChecker() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [resumes, setResumes] = useState<any[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Tailoring State
  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [tailoring, setTailoring] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchResumes = async () => {
      try {
        const res = await apiFetch<{ resumes: any[] }>('/resumes');
        if (res.ok) setResumes(res.data.resumes || []);
      } catch (err) {
        console.error('Failed to fetch resumes', err);
      }
    };
    fetchResumes();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
        setFile(f);
        setSelectedResumeId('new');
      } else {
        showToast('error', 'Please upload a PDF file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSelectedResumeId('new');
    }
  };

  const handleAnalyze = async () => {
    if (!file && !selectedResumeId) return showToast('error', 'Please select or upload a resume');

    setAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      if (selectedResumeId && selectedResumeId !== 'new') {
        formData.append('resume_id', selectedResumeId);
      } else if (file) {
        formData.append('resume_file', file);
      }
      formData.append('job_description', jobDescription);

      const res = await apiFetch('/ai/ats-check', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setResult(res.data);
        showToast('success', 'Analysis complete!');
      } else {
        showToast('error', (res.data as any)?.detail || 'Failed to analyze resume');
      }
    } catch {
      showToast('error', 'Network error while analyzing');
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--error)';
  };

  const handleTailor = async () => {
    if (!selectedResumeId || selectedResumeId === 'new') {
      return showToast('error', 'Please ensure your resume is uploaded first.');
    }
    
    setTailoring(true);
    try {
      const res = await apiFetch('/tailor/auto-apply', {
        method: 'POST',
        body: JSON.stringify({
          resume_id: selectedResumeId,
          recommendations: selectedRecommendations,
          custom_instructions: customInstructions,
        }),
      });
      
      if (res.ok) {
        showToast('success', 'Your tailored resume has been sent to your email!');
        setSelectedRecommendations([]);
        setCustomInstructions('');
      } else {
        showToast('error', (res.data as any)?.detail || 'Failed to tailor resume');
      }
    } catch {
      showToast('error', 'Network error while tailoring');
    } finally {
      setTailoring(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>ATS Resume Checker.</h1>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>Optimize your resume for Applicant Tracking Systems.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        {/* Input Section */}
        <div style={{ background: '#fff', border: '4px solid #000', boxShadow: '8px 8px 0px #000', padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', marginBottom: 12, display: 'inline-block', background: '#000', color: '#fff', padding: '4px 8px' }}>
              1. SELECT RESUME
            </h3>

            {resumes.length > 0 && (
              <select
                className="select-field"
                value={selectedResumeId}
                onChange={(e) => {
                  setSelectedResumeId(e.target.value);
                  if (e.target.value !== 'new') setFile(null);
                }}
                style={{ marginBottom: 16, width: '100%' }}
              >
                <option value="">-- Choose an uploaded resume --</option>
                {resumes.map(r => {
                  const displayName = /^[0-9a-fA-F]{24}\.?.*?$/.test(r.filename) ? 'Resume Document.pdf' : r.filename;
                  return <option key={r._id} value={r._id}>{displayName}</option>;
                })}
                <option value="new">+ Upload a new PDF</option>
              </select>
            )}

            {(!resumes.length || selectedResumeId === 'new') && (
              <div
                style={{
                  border: '4px dashed #000',
                  background: isDragging ? 'var(--accent-pink)' : '#f4f4f0',
                  padding: 40,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isDragging ? '4px 4px 0px #000' : 'none'
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
                <UploadCloud size={48} style={{ color: '#000', marginBottom: 16 }} />
                <h3 style={{ fontSize: 18, fontWeight: 900 }}>DRAG & DROP</h3>
                <p style={{ fontWeight: 600 }}>or click to browse (PDF only)</p>

                {file && (
                  <div style={{ marginTop: 16, background: 'var(--accent)', border: '3px solid #000', padding: 12, fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    <FileText size={16} />
                    {file.name}
                    <button style={{ background: '#000', color: '#fff', padding: '4px 8px', fontSize: 12, marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>X</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', marginBottom: 12, display: 'inline-block', background: '#000', color: '#fff', padding: '4px 8px' }}>
              2. JOB DESCRIPTION (OPTIONAL)
            </h3>
            <textarea
              className="input-field"
              rows={6}
              placeholder="PASTE JOB DESCRIPTION HERE..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              style={{ fontSize: 16, lineHeight: 1.5, width: '100%' }}
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleAnalyze}
            disabled={analyzing || (!file && !selectedResumeId)}
            style={{ width: '100%', fontSize: 18, padding: 20 }}
          >
            {analyzing ? (
              <>
                <Loader2 size={24} className="spin" />
                <span>ANALYZING...</span>
              </>
            ) : (
              <>
                ANALYZE RESUME <ArrowRight size={24} style={{ marginLeft: 8 }} />
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div style={{ background: '#fff', border: '4px solid #000', boxShadow: '8px 8px 0px #000', padding: 32, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {!result && !analyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#000' }}
              >
                <div style={{ background: '#f4f4f0', border: '4px solid #000', padding: 24, boxShadow: '4px 4px 0px #000', transform: 'rotate(2deg)' }}>
                  <FileText size={48} style={{ marginBottom: 16 }} />
                  <h3 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase' }}>AWAITING RESUME</h3>
                  <p style={{ fontWeight: 600 }}>Upload a resume to see your score.</p>
                </div>
              </motion.div>
            )}

            {analyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}
              >
                <Loader2 size={64} className="spin" style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: 24, fontWeight: 900, textTransform: 'uppercase' }}>AI IS READING...</h3>
              </motion.div>
            )}

            {result && !analyzing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h3 style={{ fontSize: 24, fontWeight: 900, textTransform: 'uppercase', marginBottom: 24, borderBottom: '4px solid #000', paddingBottom: 12 }}>ANALYSIS RESULTS</h3>

                <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
                  <div style={{ flex: '0 0 auto', background: getScoreColor(result.score), border: '4px solid #000', boxShadow: '6px 6px 0px #000', width: 120, height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: '#000' }}>{result.score}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', color: '#000' }}>SCORE</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                      {result.score >= 80 ? "EXCELLENT! YOUR RESUME IS HIGHLY OPTIMIZED." :
                        result.score >= 60 ? "GOOD START, BUT NEEDS SOME TWEAKS." :
                          "NEEDS SIGNIFICANT IMPROVEMENT."}
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', background: 'var(--success)', color: '#000', display: 'inline-block', padding: '4px 8px', border: '2px solid #000', marginBottom: 12 }}>
                    MATCHED KEYWORDS
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.matched_keywords?.map((kw: string) => (
                      <span key={kw} style={{ background: '#fff', border: '2px solid #000', boxShadow: '2px 2px 0px #000', padding: '4px 12px', fontSize: 14, fontWeight: 700 }}>
                        {kw}
                      </span>
                    ))}
                    {(!result.matched_keywords || result.matched_keywords.length === 0) && (
                      <span style={{ fontWeight: 600 }}>NO CLEAR MATCHES FOUND.</span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', background: 'var(--error)', color: '#000', display: 'inline-block', padding: '4px 8px', border: '2px solid #000', marginBottom: 12 }}>
                    MISSING / SUGGESTED KEYWORDS
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.missing_keywords?.map((kw: string) => (
                      <span key={kw} style={{ background: '#fff', border: '2px solid #000', boxShadow: '2px 2px 0px #000', padding: '4px 12px', fontSize: 14, fontWeight: 700 }}>
                        {kw}
                      </span>
                    ))}
                    {(!result.missing_keywords || result.missing_keywords.length === 0) && (
                      <span style={{ fontWeight: 600 }}>LOOKS GOOD! NO MAJOR MISSING SKILLS.</span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', background: 'var(--accent)', color: '#000', display: 'inline-block', padding: '4px 8px', border: '2px solid #000', marginBottom: 12 }}>
                    ACTIONABLE SUGGESTIONS
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {result.suggestions?.map((sug: string, i: number) => (
                      <label key={i} style={{ background: '#f4f4f0', border: '2px solid #000', padding: 12, fontWeight: 600, display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'center' }}>
                        <input 
                          type="checkbox" 
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRecommendations(prev => [...prev, sug]);
                            } else {
                              setSelectedRecommendations(prev => prev.filter(r => r !== sug));
                            }
                          }}
                        />
                        <span style={{ fontWeight: 900, color: 'var(--accent)' }}>{i + 1}.</span>
                        <span>{sug}</span>
                      </label>
                    ))}
                  </div>
                  
                  {selectedRecommendations.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: 24 }}>
                      <textarea
                        className="input-field"
                        rows={3}
                        placeholder="Any custom instructions for the AI? (e.g. Keep the resume under 1 page, emphasize my frontend skills)"
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        style={{ fontSize: 16, lineHeight: 1.5, width: '100%', marginBottom: 16 }}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={handleTailor}
                        disabled={tailoring}
                        style={{ width: '100%', fontSize: 18, padding: 16 }}
                      >
                        {tailoring ? <Loader2 size={24} className="spin" /> : "Send to AI & Tailor Resume"}
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
