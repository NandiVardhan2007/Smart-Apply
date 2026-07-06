import { useState, useRef } from 'react';
import { Camera, Plus, X, GraduationCap, Briefcase, Globe, Save } from 'lucide-react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { ButtonSpinner } from '../../components/LoadingSpinner';
import ImageCropModal from '../../components/ImageCropModal';
import PageHeader from '../../components/PageHeader';
import { apiFetch } from '../../api/client';
import type { User } from '../../api/types';

interface ProfileUpdateResponse {
  message: string;
  user: User;
}

function ListEditor({
  label,
  icon: Icon,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  icon: typeof GraduationCap;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };

  return (
    <div className="input-group">
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} /> {label}
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          className="input-field"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())}
          placeholder={placeholder}
        />
        <button type="button" className="btn btn-secondary btn-icon" onClick={submit} aria-label={`Add ${label}`}>
          <Plus size={17} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '9px 12px',
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13.5,
            }}
          >
            <span>{item}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label="Remove"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [education, setEducation] = useState<string[]>(user?.education || []);
  const [experience, setExperience] = useState<string[]>(user?.experience || []);
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedin_url || '');
  const [githubUrl, setGithubUrl] = useState(user?.github_url || '');
  const [portfolioUrl, setPortfolioUrl] = useState(user?.portfolio_url || '');

  const [saving, setSaving] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropMode, setCropMode] = useState<'view' | 'crop'>('crop');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const initials = (user?.full_name || user?.email || '?').charAt(0).toUpperCase();

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill('');
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropMode('crop');
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleViewAvatar = () => {
    if (!user?.profile_pic_url) return;
    setImageSrc(user.profile_pic_url);
    setCropMode('view');
    setCropModalOpen(true);
  };

  const handleAvatarSave = async (blob: Blob) => {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');
      const res = await apiFetch<{ message: string; url: string; key: string }>('/upload/avatar', { method: 'POST', body: formData });
      if (res.ok) {
        updateUser({ profile_pic_url: res.data.url });
        showToast('success', 'Profile photo updated!');
        setCropModalOpen(false);
      } else {
        showToast('error', 'Failed to upload photo.');
      }
    } catch {
      showToast('error', 'Network error while uploading photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<ProfileUpdateResponse>('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          bio,
          skills,
          education,
          experience,
          linkedin_url: linkedinUrl || null,
          github_url: githubUrl || null,
          portfolio_url: portfolioUrl || null,
        }),
      });
      if (res.ok) {
        updateUser(res.data.user);
        showToast('success', 'Profile updated!');
      } else {
        showToast('error', 'Failed to update profile.');
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-narrow">
      <PageHeader title="Profile" subtitle="Keep your information current for the best AI-powered recommendations." />

      <div className="card" style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={user?.profile_pic_url ? handleViewAvatar : undefined}
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              border: 'none',
              cursor: user?.profile_pic_url ? 'pointer' : 'default',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {user?.profile_pic_url ? (
              <img src={user.profile_pic_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change photo"
            disabled={uploadingAvatar}
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: '2px solid var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {uploadingAvatar ? <ButtonSpinner size={12} /> : <Camera size={13} />}
          </button>
          <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />
        </div>
        <div>
          <h3 style={{ fontSize: 17 }}>{user?.full_name}</h3>
          <p className="text-muted" style={{ fontSize: 13.5 }}>{user?.email}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 15.5, marginBottom: 18 }}>Basic information</h3>
        <div className="input-group">
          <label>Full name</label>
          <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Bio</label>
          <textarea className="input-field" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short summary about you…" />
        </div>
        <div className="input-group">
          <label>Skills</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              className="input-field"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
              placeholder="e.g. TypeScript"
            />
            <button type="button" className="btn btn-secondary btn-icon" onClick={handleAddSkill} aria-label="Add skill">
              <Plus size={17} />
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {skills.map((skill) => (
              <span key={skill} className="chip">
                {skill}
                <button onClick={() => setSkills(skills.filter((s) => s !== skill))} aria-label={`Remove ${skill}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 15.5, marginBottom: 18 }}>Background</h3>
        <ListEditor
          label="Education"
          icon={GraduationCap}
          items={education}
          onAdd={(v) => setEducation([...education, v])}
          onRemove={(i) => setEducation(education.filter((_, idx) => idx !== i))}
          placeholder="e.g. B.Tech in CSE, XYZ University (2024–2028)"
        />
        <ListEditor
          label="Experience"
          icon={Briefcase}
          items={experience}
          onAdd={(v) => setExperience([...experience, v])}
          onRemove={(i) => setExperience(experience.filter((_, idx) => idx !== i))}
          placeholder="e.g. DevOps Intern at APSSDC (2026)"
        />
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 15.5, marginBottom: 18 }}>Links</h3>
        <div className="input-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaGithub size={14} /> GitHub
          </label>
          <input type="url" className="input-field" placeholder="https://github.com/username" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
        </div>
        <div className="input-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaLinkedin size={14} style={{ color: '#0A66C2' }} /> LinkedIn
          </label>
          <input type="url" className="input-field" placeholder="https://linkedin.com/in/username" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
        </div>
        <div className="input-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={14} /> Portfolio
          </label>
          <input type="url" className="input-field" placeholder="https://yourname.dev" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} />
        </div>
      </div>

      <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
        {saving ? (
          <>
            <ButtonSpinner /> Saving…
          </>
        ) : (
          <>
            <Save size={16} /> Save changes
          </>
        )}
      </button>

      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={imageSrc}
        mode={cropMode}
        onClose={() => setCropModalOpen(false)}
        onSave={handleAvatarSave}
      />
    </div>
  );
}
