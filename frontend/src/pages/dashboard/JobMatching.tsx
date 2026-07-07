import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Briefcase, ExternalLink, PenTool, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { apiFetch, apiErrorMessage } from '../../api/client';
import { useToast } from '../../components/Toast';
import { PageLoader, ButtonSpinner } from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import type { Resume } from '../../api/types';

function resumeDisplayName(filename: string): string {
  return /^[0-9a-fA-F]{24}\.?.*?$/.test(filename) ? 'Resume document.pdf' : filename;
}

export default function JobMatching() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('United States');
  const [isSearching, setIsSearching] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const res = await apiFetch<{ resumes: Resume[] }>('/resumes');
      if (res.ok) {
        setResumes(res.data.resumes || []);
        if (res.data.resumes && res.data.resumes.length > 0) {
          setSelectedResumeId(res.data.resumes[0]._id);
        }
      }
    })();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedResumeId) {
      showToast('error', 'Please select a base resume to match against.');
      return;
    }
    if (!query.trim()) {
      showToast('error', 'Please enter a job title or keyword.');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const formData = new FormData();
      formData.append('resume_id', selectedResumeId);
      formData.append('query', query);
      formData.append('location', location);

      const res = await apiFetch<{ matches: any[] }>('/jobs/matches', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setJobs(res.data.matches || []);
      } else {
        showToast('error', apiErrorMessage(res, 'Failed to fetch job matches.'));
      }
    } catch {
      showToast('error', 'Network error during search.');
    } finally {
      setIsSearching(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="container">
      <PageHeader 
        title="Smart Job Matching" 
        subtitle="Find live job postings tailored specifically to your resume's strengths." 
      />

      <PageLoader 
        show={isSearching} 
        title="Scouting for jobs..." 
        subtitle="Analyzing postings and scoring them against your resume" 
      />

      <div className="card" style={{ marginBottom: 32 }}>
        <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Target Role</label>
            <div className="input-with-icon">
              <Search size={16} />
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Data Engineer, React Developer"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Location</label>
            <div className="input-with-icon">
              <MapPin size={16} />
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Remote, New York, UK"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Base Resume</label>
            <select
              className="input-field"
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
            >
              <option value="" disabled>Select a resume...</option>
              {resumes.map((r) => (
                <option key={r._id} value={r._id}>
                  {resumeDisplayName(r.filename)}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: 44 }} disabled={isSearching || resumes.length === 0}>
            {isSearching ? <ButtonSpinner /> : 'Find Matches'}
          </button>
        </form>
      </div>

      <AnimatePresence mode="wait">
        {!hasSearched ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '64px 24px' }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--surface-sunken)',
                color: 'var(--ink-faint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <Briefcase size={32} />
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Discover Your Next Role</h3>
            <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>
              We'll scan live job boards and use AI to score each role based on how well it fits your resume.
            </p>
          </motion.div>
        ) : jobs.length === 0 && !isSearching ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '64px 24px' }}
          >
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>No jobs found</h3>
            <p className="text-muted">Try broadening your search terms or location.</p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {jobs.map((job, index) => (
              <motion.div 
                key={job.job_id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card"
                style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}
              >
                {/* Score badge */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 80,
                  height: 80,
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface-sunken)',
                  border: `2px solid ${getScoreColor(job.match_score)}`,
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: getScoreColor(job.match_score) }}>
                    {job.match_score}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 4, textTransform: 'uppercase' }}>
                    Match
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: 18, marginBottom: 4, fontWeight: 600 }}>{job.title}</h3>
                      <div style={{ display: 'flex', gap: 12, fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>
                        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{job.company}</span>
                        <span>•</span>
                        <span>{job.location}</span>
                        {job.is_remote && (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--success)' }}>Remote</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => window.open(job.url, '_blank')}
                      >
                        Apply <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>

                  {job.match_reason && (
                    <div style={{ 
                      background: 'var(--surface-sunken)', 
                      padding: '12px 16px', 
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13.5,
                      color: 'var(--ink-soft)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start'
                    }}>
                      <CheckCircle2 size={16} style={{ color: getScoreColor(job.match_score), marginTop: 2, flexShrink: 0 }} />
                      <p style={{ margin: 0, lineHeight: 1.5 }}>{job.match_reason}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
