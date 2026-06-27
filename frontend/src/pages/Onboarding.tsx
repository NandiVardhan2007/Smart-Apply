import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, ArrowRight, Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { apiFetch } from '../api/client';

import '../styles/auth.css'; // Reuse auth layout styles for centered wizard

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Form State
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [education, setEducation] = useState<string[]>([]);
  const [experience, setExperience] = useState<string[]>([]);

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const executeSmartFill = async (formData: FormData) => {
    setParsing(true);
    showToast('info', 'Reading your resume with AI...', 4000);
    
    try {
      const res = await apiFetch<{
        bio: string | null;
        skills: string[];
        education: string[];
        experience: string[];
      }>('/ai/parse-resume', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = res.data;
        if (data.bio) setBio(data.bio);
        if (data.skills?.length) setSkills(data.skills);
        if (data.education?.length) setEducation(data.education);
        if (data.experience?.length) setExperience(data.experience);
        showToast('success', 'Profile auto-filled!');
        setStep(2); // Move to review step automatically
      } else {
        showToast('error', 'Failed to parse resume');
      }
    } catch (error) {
      showToast('error', 'Network error while parsing resume');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    if (file.type !== 'application/pdf') {
       return showToast('error', 'Please upload a PDF file');
    }

    const formData = new FormData();
    formData.append('resume_file', file);
    executeSmartFill(formData);
  };

  const handleSaveAndComplete = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ user: any }>('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: user?.full_name,
          bio,
          skills,
          education,
          experience
        }),
      });
      if (response.ok) {
        updateUser(response.data.user);
        showToast('success', 'Profile complete! Welcome to Smart Apply.');
        navigate('/dashboard/resumes');
      } else {
        showToast('error', 'Failed to save profile');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <motion.div
        className="auth-card"
        style={{ maxWidth: 600, width: '100%' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="auth-header">
          <h2 style={{ fontSize: '1.8rem' }}>Welcome, {(user?.full_name || '').split(' ')[0] || 'User'}!</h2>
          <p>Let's set up your profile to personalize your experience.</p>
        </div>

        {/* STEP INDICATOR */}
        <div className="step-indicator" style={{ marginBottom: 32 }}>
          <div className={`step-dot ${step >= 1 ? 'active' : ''}`} />
          <div className={`step-line ${step >= 2 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
        </div>

        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h3 style={{ marginBottom: 12 }}>The Fast Way</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.95rem' }}>
                Upload your latest resume and our AI will instantly build your profile for you.
              </p>
              
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="application/pdf"
                onChange={handleFileUpload}
              />
              <button 
                className="btn btn-primary btn-lg" 
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                style={{ width: '100%', marginBottom: 16 }}
              >
                {parsing ? <Loader2 size={20} className="spin" /> : <Upload size={20} />}
                <span style={{ marginLeft: 8 }}>{parsing ? 'Analyzing Resume...' : 'Upload PDF Resume'}</span>
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--text-muted)' }}>
                <hr style={{ flex: 1, borderColor: 'var(--border-color)' }} />
                <span style={{ padding: '0 12px', fontSize: '0.85rem' }}>OR</span>
                <hr style={{ flex: 1, borderColor: 'var(--border-color)' }} />
              </div>

              <button 
                className="btn btn-secondary" 
                onClick={() => setStep(2)}
                style={{ width: '100%' }}
              >
                Skip & Fill Manually
                <ArrowRight size={16} style={{ marginLeft: 8 }} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h3 style={{ marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              {bio || skills.length ? 'Review your AI-generated Profile' : 'Fill out your Details'}
            </h3>
            
            <div className="auth-form" style={{ textAlign: 'left' }}>
              <div className="input-group">
                <label>Bio (Summary)</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="I am a software engineer..."
                />
              </div>

              <div className="input-group">
                <label>Skills</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    className="input-field"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                    placeholder="E.g. React, Python"
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleAddSkill}>
                    <Plus size={18} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {skills.map((skill) => (
                    <span key={skill} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', background: 'var(--bg-input)',
                      borderRadius: 16, fontSize: '0.85rem',
                      boxShadow: 'var(--shadow-inset)', border: '1px solid rgba(0,0,0,0.2)'
                    }}>
                      {skill}
                      <button onClick={() => handleRemoveSkill(skill)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No skills added</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleSaveAndComplete} disabled={loading} style={{ flex: 2 }}>
                  {loading ? <Loader2 size={18} className="spin" /> : 'Complete Setup'}
                </button>
              </div>
            </div>
          </motion.div>
        )}


      </motion.div>
    </div>
  );
}
