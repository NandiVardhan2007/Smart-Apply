import React, { useState, useEffect } from 'react';
import { apiFetch, getApiBaseUrl } from '../../api/client';
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
      const token = localStorage.getItem('sa_token');
      const response = await fetch(`${getApiBaseUrl()}/resume-maker/templates/${selectedTemplate._id}/compile`, {
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
      const response = await apiFetch(`/resume-maker/templates/${selectedTemplate._id}/smart-fill`, {
        method: 'POST',
        body: JSON.stringify({ resume_id: selectedResumeId })
      });

      if (!response.ok) {
        showToast('error', (response.data as any)?.detail || 'Failed to smart fill resume.');
        return;
      }

      const resData = response.data as any;
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
      <div className="container fade-in" style={{ paddingBottom: '40px' }}>
        <button 
          className="btn btn-ghost" 
          style={{ marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }} 
          onClick={() => setSelectedTemplate(null)}
        >
          &larr; Back to templates
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', alignItems: 'start' }}>
          
          {/* Left Side: Template Presentation */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
            style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '100px' }}
          >
            <div style={{ width: '100%', aspectRatio: '1 / 1.4', backgroundColor: 'var(--surface-sunken)', position: 'relative' }}>
              {selectedTemplate.image_url ? (
                <img 
                  src={selectedTemplate.image_url} 
                  alt={selectedTemplate.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)' }}>
                  No Preview
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 24px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '24px' }}>{selectedTemplate.name}</h2>
                <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                  {selectedTemplate.description || `A professional template requiring ${selectedTemplate.required_fields.length} details.`}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Side: Form & Magic Fill */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            <div>
              <h1 className="text-accent" style={{ fontSize: '32px', marginBottom: '8px' }}>Build Your Resume</h1>
              <p className="text-muted" style={{ fontSize: '16px' }}>Provide the details below or use AI to magically fill them in.</p>
            </div>

            {resumes.length > 0 && (
              <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ padding: '8px', background: 'var(--accent-soft)', borderRadius: '8px', color: 'var(--accent)' }}>
                    <Wand2 size={20} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>AI Smart Fill</h3>
                </div>
                <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>Select an existing resume to automatically extract and format your data into this template.</p>
                
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <select 
                    className="input-field" 
                    value={selectedResumeId} 
                    onChange={e => setSelectedResumeId(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--bg-input)' }}
                  >
                    {resumes.map(r => (
                      <option key={r._id} value={r._id}>
                        {/^[0-9a-fA-F]{24}\.?.*?$/.test(r.filename) ? 'Resume document.pdf' : r.filename}
                      </option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleSmartFill} 
                    disabled={filling || !selectedResumeId}
                    style={{ flexShrink: 0 }}
                  >
                    {filling ? <ButtonSpinner /> : 'Autofill Template'}
                  </button>
                </div>
              </div>
            )}

            <div className="card">
              <form onSubmit={handleCompile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  {selectedTemplate.required_fields.map((field, index) => (
                    <motion.div 
                      key={field} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <label style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        required
                        value={formData[field] || ''}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                        style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                      />
                    </motion.div>
                  ))}
                </div>
                
                <div style={{ marginTop: '16px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                  <button type="submit" className="btn btn-primary" disabled={compiling} style={{ width: '100%', padding: '16px', fontSize: '16px' }}>
                    {compiling ? <ButtonSpinner /> : <><Download size={20} /> Generate Professional PDF</>}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
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
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <SkeletonCard height={300} />
            </motion.div>
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

      <style>{`
        @media (max-width: 768px) {
          .resume-maker-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .resume-maker-detail-grid > div:first-child {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}

