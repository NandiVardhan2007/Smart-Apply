import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, UploadCloud, Trash2 } from 'lucide-react';
import { SkeletonCard, ButtonSpinner } from '../../components/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

interface Resume {
  _id: string;
  filename: string;
  file_url: string;
  is_primary: boolean;
  uploaded_at: string;
}

export default function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const fetchResumes = useCallback(async () => {
    try {
      const res = await apiFetch<{ resumes: Resume[] }>('/resumes');
      if (res.ok) {
        setResumes(res.data.resumes || []);
      }
    } catch {
      showToast('error', 'Failed to fetch resumes');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      return showToast('error', 'Only PDF files are supported.');
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/resumes', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        showToast('success', 'Resume uploaded and processed successfully!');
        fetchResumes();
      } else {
        showToast('error', 'Failed to upload resume.');
      }
    } catch {
      showToast('error', 'Network error while uploading resume.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this resume?')) return;
    try {
      const res = await apiFetch(`/resumes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setResumes(resumes.filter((r) => r._id !== id));
        showToast('success', 'Resume deleted');
      } else {
        showToast('error', 'Failed to delete resume');
      }
    } catch {
      showToast('error', 'Network error');
    }
  };

  return (
    <div className="resumes-page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="dashboard-page-header">
        <h1>My Resumes</h1>
        <p>Manage your uploaded resumes for quick ATS checks and smart fills.</p>
      </div>

      <div className="settings-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>Add a Resume</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload a PDF to use with Smart Fill and ATS Checker.</p>
        </div>
        <div className="ats-upload-area" style={{ margin: 24, borderStyle: 'dashed' }} onClick={() => fileInputRef.current?.click()}>
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <UploadCloud size={48} className="ats-upload-icon" style={{ color: 'var(--accent-start)' }} />
          <h3>{uploading ? 'Processing AI Extraction...' : 'Drag & drop your resume here'}</h3>
          <p>or click to browse files (PDF only, up to 10MB)</p>
          {uploading && <div style={{ marginTop: 16 }}><ButtonSpinner size={24} /></div>}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} height={160} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <AnimatePresence>
            {resumes.map((resume) => (
              <motion.div
                key={resume._id}
                className="settings-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ padding: 12, background: 'var(--accent-soft)', borderRadius: 8, color: 'var(--accent-start)' }}>
                    <FileText size={24} />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <h4 style={{ margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {/^[0-9a-fA-F]{24}\.?.*?$/.test(resume.filename) ? 'Resume Document.pdf' : resume.filename}
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={resume.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                      View PDF
                    </a>
                    <Link to={`/dashboard/tailor-resume/${btoa(resume._id)}`} className="btn btn-primary btn-sm">
                      Edit PDF
                    </Link>
                  </div>
                  <button onClick={() => handleDelete(resume._id)} className="btn btn-sm" style={{ color: 'var(--error)', background: 'transparent' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {!resumes.length && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ 
                width: 80, height: 80, margin: '0 auto 20px', 
                background: 'var(--bg-input)', borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-inset)', border: '1px solid rgba(0,0,0,0.3)'
              }}>
                <FileText size={32} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 style={{ marginBottom: 8, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>No resumes found</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Upload your first resume to get started with ATS analysis.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
