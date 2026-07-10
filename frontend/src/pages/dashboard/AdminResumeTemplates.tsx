import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';
import PageHeader from '../../components/PageHeader';
import { FileText, Plus, Image as ImageIcon } from 'lucide-react';
import type { ResumeTemplate } from '../../api/types';
import { ButtonSpinner } from '../../components/LoadingSpinner';

export default function AdminResumeTemplates() {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [latexCode, setLatexCode] = useState('');
  const [requiredFields, setRequiredFields] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch<{ templates: ResumeTemplate[] }>('/resume-maker/templates');
      if (res.ok) setTemplates(res.data.templates || []);
    } catch {
      showToast('error', 'Failed to fetch templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('error', 'Please select a preview image.');
      return;
    }
    
    let parsedFields = [];
    try {
      parsedFields = requiredFields.split(',').map(f => f.trim()).filter(f => f);
    } catch {
      showToast('error', 'Invalid required fields format.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('latex_code', latexCode);
    formData.append('required_fields', JSON.stringify(parsedFields));
    formData.append('image', selectedFile);

    try {
      const res = await apiFetch('/resume-maker/templates', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        showToast('success', 'Template created successfully!');
        setShowForm(false);
        fetchTemplates();
        setName('');
        setDescription('');
        setLatexCode('');
        setRequiredFields('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        showToast('error', (res.data as any)?.detail || 'Failed to create template.');
      }
    } catch (err) {
      showToast('error', 'Network error.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container fade-in">
      <PageHeader title="Manage Resume Templates" subtitle="Add new LaTeX resume templates for users." />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {showForm ? 'Cancel' : 'New Template'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 30 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Create New Template</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Name</label>
                <input required className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Modern Tech" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Description</label>
                <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Required Fields (Comma separated)</label>
              <input required className="input" value={requiredFields} onChange={e => setRequiredFields(e.target.value)} placeholder="e.g. Name, Email, Phone, Experience" />
              <p className="text-faint" style={{ fontSize: 12, margin: 0 }}>These will be replaced in LaTeX as {'{{FieldName}}'}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>LaTeX Code</label>
              <textarea
                required
                className="input"
                style={{ height: 200, fontFamily: 'monospace', fontSize: 12 }}
                value={latexCode}
                onChange={e => setLatexCode(e.target.value)}
                placeholder="\\documentclass{article}..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Preview Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  ref={fileInputRef}
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={16} /> Select Image
                </button>
                <span className="text-faint">{selectedFile ? selectedFile.name : 'No file selected'}</span>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? <ButtonSpinner /> : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid-auto-fit">
        {loading ? (
          <div>Loading...</div>
        ) : templates.length === 0 ? (
          <div>No templates found.</div>
        ) : (
          templates.map(t => (
            <div key={t._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 80, height: 100, background: '#f5f5f5' }}>
                {t.image_url ? (
                  <img src={t.image_url} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <FileText style={{ margin: 'auto' }} />
                )}
              </div>
              <div>
                <h4 style={{ margin: 0 }}>{t.name}</h4>
                <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{t.description}</p>
                <p className="text-faint" style={{ margin: '4px 0 0', fontSize: 12 }}>{t.required_fields.length} fields</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
