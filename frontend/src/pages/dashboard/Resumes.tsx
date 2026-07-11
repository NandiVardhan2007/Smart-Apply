import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, UploadCloud, Trash2, ExternalLink, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';
import { SkeletonCard, ButtonSpinner } from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import type { Resume } from '../../api/types';

/** The backend stores the original filename, but freshly re-uploaded / smart-filled
 * resumes sometimes carry a raw ObjectId as their name — show something readable instead. */
function displayName(filename: string): string {
  return /^[0-9a-fA-F]{24}\.?.*?$/.test(filename) ? 'Resume document.pdf' : filename;
}

export default function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);

  const fetchResumes = useCallback(async () => {
    try {
      const res = await apiFetch<{ resumes: Resume[] }>('/resumes');
      if (res.ok) setResumes(res.data.resumes || []);
    } catch {
      showToast('error', 'Failed to fetch resumes.');
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
      showToast('error', 'Only PDF files are supported.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/resumes', { method: 'POST', body: formData });
      if (res.ok) {
        showToast('success', 'Resume uploaded successfully!');
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

  const confirmDelete = (id: string) => {
    setDeletingResumeId(id);
  };

  const handleDelete = async () => {
    if (!deletingResumeId) return;
    try {
      const res = await apiFetch(`/resumes/${deletingResumeId}`, { method: 'DELETE' });
      if (res.ok) {
        setResumes((prev) => prev.filter((r) => r._id !== deletingResumeId));
        showToast('success', 'Resume deleted.');
      } else {
        showToast('error', 'Failed to delete resume.');
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setDeletingResumeId(null);
    }
  };

  return (
    <div className="container">
      <PageHeader title="My resumes" subtitle="Manage your uploaded resumes for quick ATS checks and smart fills." />

      <div className="card card-flush" style={{ marginBottom: 24 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15.5, marginBottom: 3 }}>Add a resume</h3>
          <p className="text-muted" style={{ fontSize: 13.5 }}>Upload a PDF to use with Smart Fill and the ATS checker.</p>
        </div>
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            margin: 22,
            padding: '36px 20px',
            border: '1.5px dashed var(--border-strong)',
            borderRadius: 'var(--radius)',
            textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer',
            transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
          }}
        >
          <input type="file" accept=".pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUpload} />
          <UploadCloud size={32} style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>
            {uploading ? 'Processing your resume…' : 'Drag & drop your resume here'}
          </h3>
          <p className="text-muted" style={{ fontSize: 13 }}>or click to browse (PDF only, up to 10MB)</p>
          {uploading && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <ButtonSpinner size={22} />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid-auto-fit">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} height={150} />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Upload your first resume to get started with ATS analysis and tailoring."
        />
      ) : (
        <div className="grid-auto-fit">
          <AnimatePresence>
            {resumes.map((resume) => (
              <motion.div
                key={resume._id}
                className="card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: 14.5, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName(resume.filename)}
                    </h4>
                    <div className="text-faint" style={{ fontSize: 12.5 }}>
                      Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
                      {resume.is_primary && <span className="badge badge-accent" style={{ marginLeft: 8 }}>Primary</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={resume.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                      <ExternalLink size={14} /> View
                    </a>
                    <Link to={`/dashboard/tailor-resume/${btoa(resume._id)}`} className="btn btn-primary btn-sm">
                      <Pencil size={14} /> Edit
                    </Link>
                  </div>
                  <button
                    onClick={() => confirmDelete(resume._id)}
                    className="btn btn-ghost btn-icon"
                    aria-label="Delete resume"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {deletingResumeId && (
          <div className="modal-overlay" onClick={() => setDeletingResumeId(null)}>
            <motion.div
              className="modal"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-resume-title"
              tabIndex={-1}
            >
              <h3 id="delete-resume-title" style={{ fontSize: 18, marginBottom: 10 }}>Delete resume?</h3>
              <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>
                Are you sure you want to delete this resume? It will no longer be available for ATS checking or job matching.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary btn-block" onClick={() => setDeletingResumeId(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger btn-block" onClick={handleDelete} autoFocus>
                  Yes, delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
