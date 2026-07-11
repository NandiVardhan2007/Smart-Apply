import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';
import PageHeader from '../../components/PageHeader';
import { SkeletonCard, ButtonSpinner } from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { FileText, Download, Wand2 } from 'lucide-react';
import type { ResumeTemplate, Resume } from '../../api/types';
import { motion, AnimatePresence } from 'framer-motion';

export default function ResumeMaker() {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [compiling, setCompiling] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [filling, setFilling] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch<{ templates: ResumeTemplate[] }>('/resume-maker/templates');
      if (res.ok) {
        setTemplates(res.data.templates || []);
      } else {
        showToast('error', 'Failed to fetch templates.');
      }
      const resResumes = await apiFetch<{ resumes: Resume[] }>('/resumes');
      if (resResumes.ok) {
        setResumes(resResumes.data.resumes || []);
        if (resResumes.data.resumes && resResumes.data.resumes.length > 0) {
          setSelectedResumeId(resResumes.data.resumes[0]._id);
        }
      }
    } catch {
      showToast('error', 'Network error while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (t: ResumeTemplate) => {
    setSelectedTemplate(t);
    const initialData: Record<string, string> = {};
    t.required_fields.forEach(f => {
      initialData[f] = '';
    });
    setFormData(initialData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    setCompiling(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/resume-maker/templates/${selectedTemplate._id}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        showToast('error', errData.detail || 'Failed to compile resume.');
        setCompiling(false);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Resume_${selectedTemplate.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('success', 'Resume generated successfully!');
      setSelectedTemplate(null);
    } catch (err) {
      showToast('error', 'Error generating resume.');
    } finally {
      setCompiling(false);
    }
  };

  const handleSmartFill = async () => {
    if (!selectedTemplate || !selectedResumeId) return;
    setFilling(true);
    showToast('info', 'AI is smart filling your resume...', 3000);
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/resume-maker/templates/${selectedTemplate._id}/smart-fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resume_id: selectedResumeId })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        showToast('error', errData.detail || 'Failed to smart fill resume.');
        return;
      }

      const resData = await response.json();
      if (resData.filled_data) {
        setFormData(prev => ({
          ...prev,
          ...resData.filled_data
        }));
        showToast('success', 'Smart fill complete! You can now edit the fields.');
      }
    } catch (err) {
      showToast('error', 'Error smart filling resume.');
    } finally {
      setFilling(false);
    }
  };

  if (selectedTemplate) {
    return (
      <div className="container fade-in">
        <PageHeader title={`Compile: ${selectedTemplate.name}`} subtitle="Fill out the details below to generate your perfect resume." />
        <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => setSelectedTemplate(null)}>
          &larr; Back to templates
        </button>

        <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
          {resumes.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'var(--surface-sunken)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-faint)' }}>Smart Fill from Resume</label>
                <select 
                  className="input" 
                  value={selectedResumeId} 
                  onChange={e => setSelectedResumeId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {resumes.map(r => (
                    <option key={r._id} value={r._id}>
                      {/^[0-9a-fA-F]{24}\.?.*?$/.test(r.filename) ? 'Resume document.pdf' : r.filename}
                    </option>
                  ))}
                </select>
              </div>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSmartFill} 
                disabled={filling || !selectedResumeId}
                style={{ marginTop: 20 }}
              >
                {filling ? <ButtonSpinner /> : <><Wand2 size={16} /> Smart Fill</>}
              </button>
            </div>
          )}

          <form onSubmit={handleCompile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedTemplate.required_fields.map(field => (
              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontWeight: 500, fontSize: 14 }}>{field}</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData[field] || ''}
                  onChange={(e) => handleInputChange(field, e.target.value)}
                  placeholder={`Enter your ${field}`}
                />
              </div>
            ))}
            
            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" disabled={compiling} style={{ width: '100%' }}>
                {compiling ? <ButtonSpinner /> : <><Download size={18} /> Generate PDF</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container fade-in">
      <PageHeader title="Resume Maker" subtitle="Choose a template and generate a PDF resume in minutes." />

      {loading ? (
        <div className="grid-auto-fit">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} height={300} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates found"
          description="Check back later for new resume templates."
        />
      ) : (
        <div className="grid-auto-fit" style={{ gap: 24 }}>
          <AnimatePresence>
            {templates.map(template => (
              <motion.div
                key={template._id}
                className="card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                onClick={() => handleSelectTemplate(template)}
              >
                <div style={{ width: '100%', height: 250, backgroundColor: 'var(--surface-sunken)' }}>
                  {template.image_url ? (
                    <img src={template.image_url} alt={template.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)' }}>
                      No Preview
                    </div>
                  )}
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>{template.name}</h3>
                  <p className="text-muted" style={{ fontSize: 13, marginBottom: 0 }}>
                    {template.description || `${template.required_fields.length} required fields`}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
