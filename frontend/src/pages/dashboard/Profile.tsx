import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Plus, X, Save, Loader2, Upload, FileText, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { apiFetch } from '../../api/client';
import ImageCropModal from '../../components/ImageCropModal';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'crop'>('view');
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

  const [resumes, setResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('new');
  
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [newSkill, setNewSkill] = useState('');
  
  const [linkedin, setLinkedin] = useState(user?.linkedin_url || '');
  const [github, setGithub] = useState(user?.github_url || '');
  const [portfolio, setPortfolio] = useState(user?.portfolio_url || '');
  const [education, setEducation] = useState<string[]>(user?.education || []);
  const [experience, setExperience] = useState<string[]>(user?.experience || []);

  const initials = (fullName || 'Smart Apply')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

  // Hydrate the full profile from the backend on mount. The user object in
  // AuthContext comes from the login/signup response, which only carries
  // identity fields (id, email, full_name, is_verified, profile_pic_url) —
  // never bio/skills/education/experience/social links. Without this fetch,
  // a user who filled out their profile in a previous session and then logs
  // in again sees a page that looks empty, even though the data is saved.
  useEffect(() => {
    const fetchFullProfile = async () => {
      try {
        const res = await apiFetch<{
          full_name: string;
          bio: string | null;
          skills: string[];
          linkedin_url: string | null;
          github_url: string | null;
          portfolio_url: string | null;
          education: string[];
          experience: string[];
          profile_pic_url: string | null;
        }>('/user/profile');
        if (res.ok) {
          updateUser(res.data);
        } else {
          showToast('error', 'Failed to load profile data');
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
        showToast('error', 'Network error while loading profile');
      }
    };
    fetchFullProfile();
    // Runs once on mount — the sync-effect below picks up the result via `user`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state when user object loads or updates
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setBio(user.bio || '');
      setSkills(user.skills || []);
      setLinkedin(user.linkedin_url || '');
      setGithub(user.github_url || '');
      setPortfolio(user.portfolio_url || '');
      setEducation(user.education || []);
      setExperience(user.experience || []);
    }
  }, [user]);

  // Calculate completion percentage
  const calculateCompletion = () => {
    let score = 0;
    if (fullName) score += 20;
    if (bio) score += 20;
    if (skills.length > 0) score += 20;
    if (linkedin || github || portfolio) score += 20;
    if (education.length > 0 || experience.length > 0) score += 20;
    return score;
  };
  const completionPercent = calculateCompletion();

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ user: any; detail?: string }>('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          bio,
          skills,
          linkedin_url: linkedin,
          github_url: github,
          portfolio_url: portfolio,
          education,
          experience
        }),
      });
      if (response.ok) {
        updateUser(response.data.user);
        showToast('success', 'Profile updated successfully');
      } else {
        showToast('error', response.data.detail || 'Failed to update profile');
      }
    } catch (e) {
      showToast('error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const executeSmartFill = async (formData: FormData) => {
    setParsing(true);
    showToast('success', 'Reading resume with AI...');
    
    try {
      const res = await apiFetch<{
        full_name: string | null;
        bio: string | null;
        skills: string[];
        education: string[];
        experience: string[];
        linkedin_url: string | null;
        github_url: string | null;
        portfolio_url: string | null;
      }>('/ai/parse-resume', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = res.data;
        if (data.full_name) setFullName(data.full_name);
        if (data.bio) setBio(data.bio);
        if (data.skills?.length) setSkills([...new Set([...skills, ...data.skills])]);
        if (data.education?.length) setEducation(data.education);
        if (data.experience?.length) setExperience(data.experience);
        if (data.linkedin_url) setLinkedin(data.linkedin_url);
        if (data.github_url) setGithub(data.github_url);
        if (data.portfolio_url) setPortfolio(data.portfolio_url);
        showToast('success', 'Profile auto-filled from resume!');
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

  const handleSmartFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    if (file.type !== 'application/pdf') {
       return showToast('error', 'Please upload a PDF file for Smart Fill');
    }

    const formData = new FormData();
    formData.append('resume_file', file);
    executeSmartFill(formData);
  };

  const handleLibrarySmartFill = () => {
    if (selectedResumeId === 'new' || !selectedResumeId) {
      fileInputRef.current?.click();
      return;
    }
    const formData = new FormData();
    formData.append('resume_id', selectedResumeId);
    executeSmartFill(formData);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setSelectedImageSrc(reader.result?.toString() || null);
      setModalMode('crop');
      setModalOpen(true);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    });
    reader.readAsDataURL(file);
  };

  const handleCropSave = async (croppedBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', croppedBlob, 'avatar.jpg');

    setUploadingAvatar(true);
    try {
      const res = await apiFetch<{ url: string }>('/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      if (res.ok && res.data.url) {
        updateUser({ ...user, profile_pic_url: res.data.url });
        showToast('success', 'Profile picture updated!');
        setModalOpen(false);
      } else {
        showToast('error', 'Failed to upload profile picture');
      }
    } catch (err) {
      showToast('error', 'Network error while uploading');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleViewAvatar = () => {
    if (user?.profile_pic_url) {
      setSelectedImageSrc(user.profile_pic_url);
      setModalMode('view');
      setModalOpen(true);
    }
  };

  return (
    <div className="profile-page">
      <div className="page-welcome-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '8px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Complete your profile, {(user?.full_name || '').split(' ')[0] || 'there'}!</h1>
            <p style={{ color: 'var(--text-secondary)' }}>A complete profile increases your chances of getting noticed by ATS algorithms.</p>
          </div>
          <div style={{ flex: '1', minWidth: '250px', maxWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600 }}>Profile Strength</span>
              <span style={{ color: 'var(--accent-start)', fontWeight: 700 }}>{completionPercent}%</span>
            </div>
            <div className="feedback-score-bar" style={{ margin: 0, height: '10px' }}>
              <div className="feedback-score-fill" style={{ width: `${completionPercent}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-grid">
        {/* Sidebar Card */}
        <div className="settings-card">
          <div className="profile-sidebar-card">
            <div className="profile-avatar-section">
              <div 
                className="profile-avatar" 
                onClick={handleViewAvatar}
                style={{ cursor: user?.profile_pic_url ? 'pointer' : 'default' }}
                title={user?.profile_pic_url ? "Click to view" : ""}
              >
                {uploadingAvatar ? (
                  <Loader2 size={24} className="spin" />
                ) : user?.profile_pic_url ? (
                  <img src={user.profile_pic_url} alt="Profile" />
                ) : (
                  initials
                )}
              </div>
              <input
                type="file"
                ref={avatarInputRef}
                style={{ display: 'none' }}
                accept="image/png, image/jpeg, image/webp, image/gif"
                onChange={handleAvatarUpload}
              />
              <button 
                className="avatar-upload-btn" 
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Camera size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />
                Change Photo
              </button>
            </div>
            <h3 style={{ marginBottom: 4 }}>{fullName}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user?.email}</p>
            
            <div style={{ marginTop: 32, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                <FileText size={24} style={{ color: 'var(--accent-start)', marginBottom: 8 }} />
                <h4 style={{ marginBottom: 8 }}>Smart Fill</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    Let AI fill out your profile details from an existing resume or a new upload.
                </p>

                {resumes.length > 0 && (
                  <select
                    className="select-field"
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    style={{ marginBottom: 12, fontSize: '0.85rem', padding: '8px 12px' }}
                  >
                    <option value="new">+ Upload a new PDF</option>
                    {resumes.map(r => (
                      <option key={r._id} value={r._id}>{r.filename}</option>
                    ))}
                  </select>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="application/pdf"
                  onChange={handleSmartFill}
                />
                <button 
                  className="btn btn-outline" 
                  onClick={handleLibrarySmartFill}
                  disabled={parsing}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {parsing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                  <span style={{ marginLeft: 8 }}>{parsing ? 'Parsing...' : (selectedResumeId === 'new' ? 'Upload PDF' : 'Smart Fill')}</span>
                </button>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="settings-card">
          <div className="profile-form">
            <h3 style={{ marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>Personal Details</h3>
            
            <div className="input-group">
              <label>Full Name</label>
              <input
                type="text"
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Bio</label>
              <textarea
                className="input-field"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell recruiters a bit about yourself..."
              />
            </div>

            <h3 style={{ marginTop: 32, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>Social Links</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                <div className="input-group">
                  <label>LinkedIn URL</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input-field"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      style={{ flex: 1 }}
                    />
                    {linkedin && (
                      <a href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`} target="_blank" rel="noreferrer" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 44, height: 44, background: 'var(--accent)', border: '2px solid #000',
                        color: '#000', flexShrink: 0, textDecoration: 'none'
                      }}>
                        <ExternalLink size={20} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="input-group">
                  <label>GitHub URL</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input-field"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      placeholder="https://github.com/..."
                      style={{ flex: 1 }}
                    />
                    {github && (
                      <a href={github.startsWith('http') ? github : `https://${github}`} target="_blank" rel="noreferrer" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 44, height: 44, background: 'var(--accent)', border: '2px solid #000',
                        color: '#000', flexShrink: 0, textDecoration: 'none'
                      }}>
                        <ExternalLink size={20} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Portfolio Website</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input-field"
                      value={portfolio}
                      onChange={(e) => setPortfolio(e.target.value)}
                      placeholder="https://mywebsite.com"
                      style={{ flex: 1 }}
                    />
                    {portfolio && (
                      <a href={portfolio.startsWith('http') ? portfolio : `https://${portfolio}`} target="_blank" rel="noreferrer" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 44, height: 44, background: 'var(--accent)', border: '2px solid #000',
                        color: '#000', flexShrink: 0, textDecoration: 'none'
                      }}>
                        <ExternalLink size={20} />
                      </a>
                    )}
                  </div>
                </div>
            </div>

            <h3 style={{ marginTop: 32, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>Experience & Education</h3>

            <div className="input-group">
              <label>Education (Comma separated for now)</label>
              <textarea
                className="input-field"
                rows={3}
                value={education.join('\n')}
                onChange={(e) => setEducation(e.target.value.split('\n'))}
                placeholder="B.S. in Computer Science at XYZ University..."
              />
            </div>

            <div className="input-group">
              <label>Experience (Comma separated for now)</label>
              <textarea
                className="input-field"
                rows={4}
                value={experience.join('\n')}
                onChange={(e) => setExperience(e.target.value.split('\n'))}
                placeholder="Software Engineer Intern at XYZ..."
              />
            </div>

            <h3 style={{ marginTop: 32, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>Skills</h3>

            <div className="input-group">
              <div className="skill-input-row">
                <input
                  type="text"
                  className="input-field"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  placeholder="Add a skill (e.g. React)"
                />
                <button type="button" className="btn btn-secondary" onClick={handleAddSkill}>
                  <Plus size={18} />
                </button>
              </div>
              <div className="skills-container">
                {skills.map((skill) => (
                  <motion.span
                    key={skill}
                    className="skill-tag"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    {skill}
                    <button onClick={() => handleRemoveSkill(skill)}>
                      <X size={14} />
                    </button>
                  </motion.span>
                ))}
              </div>
            </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                  <span style={{ marginLeft: 8 }}>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      <ImageCropModal 
        isOpen={modalOpen}
        imageSrc={selectedImageSrc}
        mode={modalMode}
        onClose={() => setModalOpen(false)}
        onSave={handleCropSave}
      />
    </div>
  );
}
