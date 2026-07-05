import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Clock, Star, ArrowRight, ChevronLeft, CheckCircle } from 'lucide-react';
import { InlineLoader, ButtonSpinner } from '../../components/LoadingSpinner';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

interface Project {
  id: string;
  title: string;
  description: string;
  rating: number;
  skill_level: string;
  estimated_time: string;
  key_technologies: string[];
}

interface RoadmapPhase {
  phase_number: number;
  title: string;
  description: string;
  tasks: string[];
}

export default function ProjectRecommender() {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [skills, setSkills] = useState('');
  const [timeCommitment, setTimeCommitment] = useState('');
  const [interests, setInterests] = useState('');

  // Roadmap Preferences State
  const [dbPref, setDbPref] = useState('');
  const [hostingPref, setHostingPref] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [monetization, setMonetization] = useState('');
  const [extraPref, setExtraPref] = useState('');

  // Results
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapPhase[]>([]);

  const handleGetRecommendations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skills || !timeCommitment || !interests) {
      showToast('error', 'Please fill out all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<Project[]>('/projects/recommend', {
        method: 'POST',
        body: JSON.stringify({
          skills,
          time_commitment: timeCommitment,
          interests,
        }),
      });

      if (res.ok && res.data) {
        setProjects(res.data);
        setStep(2);
      } else {
        showToast('error', 'Failed to get recommendations');
      }
    } catch (err) {
      showToast('error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareRoadmap = (project: Project) => {
    setSelectedProject(project);
    setStep(3); // Go to preferences step
  };

  const handleGenerateRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      const res = await apiFetch<{ phases: RoadmapPhase[] }>('/projects/roadmap', {
        method: 'POST',
        body: JSON.stringify({ 
          project_details: selectedProject,
          preferences: {
            "Preferred Database": dbPref,
            "Preferred Hosting": hostingPref,
            "Team Size": teamSize,
            "Target Audience": targetAudience,
            "Monetization Strategy": monetization,
            "Additional Requirements": extraPref
          }
        }),
      });

      if (res.ok && res.data?.phases) {
        setRoadmap(res.data.phases);
        setStep(4);
      } else {
        showToast('error', 'Failed to generate roadmap');
      }
    } catch (err) {
      showToast('error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="dashboard-page-header">
        <h1>Project Finder</h1>
        <p>Get AI-tailored software project recommendations and step-by-step roadmaps.</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="settings-card"
            style={{ background: 'var(--accent-yellow)' }}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 24 }}>1. Tell us about yourself</h2>
            <form onSubmit={handleGetRecommendations} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Current Skills & Technologies</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., React, Python basics, Tailwind"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Available Time</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., 10 hours a week, or 1 month total"
                  value={timeCommitment}
                  onChange={(e) => setTimeCommitment(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Interests & Goals</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="e.g., I want to build a SaaS, I like AI, I want to learn databases..."
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ alignSelf: 'flex-start', fontSize: '1.1rem', padding: '12px 32px' }}
                disabled={loading}
              >
                {loading ? (
                  <><span style={{ marginRight: 8, display: 'inline-flex' }}><ButtonSpinner size={18} /></span> Analyzing...</>
                ) : (
                  <>Find Projects <ArrowRight size={20} style={{ marginLeft: 8 }} /></>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <button 
              className="btn" 
              style={{ marginBottom: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', fontWeight: 700 }}
              onClick={() => setStep(1)}
              disabled={loading}
            >
              <ChevronLeft size={20} style={{ marginRight: 8 }} /> Back
            </button>
            
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 24 }}>2. Recommended Projects</h2>
            
            {loading ? (
              <InlineLoader
                variant="generate"
                title="GENERATING YOUR ROADMAP..."
                subtitle="Finding the best projects matched to your skills"
              />
            ) : (
              <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {projects.map((proj) => (
                  <div key={proj.id} className="settings-card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{proj.title}</h3>
                      <div style={{ background: 'var(--accent)', color: 'var(--bg-surface)', fontWeight: 700, padding: '4px 8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={14} fill="#000" /> {proj.rating}/10
                      </div>
                    </div>
                    
                    <p style={{ fontWeight: 500, marginBottom: 16, flex: 1 }}>{proj.description}</p>
                    
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, background: '#eee', padding: '4px 8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Code size={14} /> {proj.skill_level}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, background: '#eee', padding: '4px 8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} /> {proj.estimated_time}
                      </span>
                    </div>

                    <div style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {proj.key_technologies.map(tech => (
                        <span key={tech} style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--accent-pink)', color: 'var(--bg-surface)', padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 999 }}>
                          {tech}
                        </span>
                      ))}
                    </div>

                    <button 
                      className="btn btn-primary" 
                      style={{ 
                        width: '100%', 
                        justifyContent: 'center', 
                        fontSize: '0.85rem', 
                        padding: '12px 8px', 
                        whiteSpace: 'normal', 
                        textAlign: 'center',
                        lineHeight: 1.4
                      }}
                      onClick={() => handlePrepareRoadmap(proj)}
                    >
                      Customize & Generate Roadmap
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {step === 3 && selectedProject && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="settings-card"
            style={{ background: 'var(--accent-pink)' }}
          >
            <button 
              className="btn" 
              style={{ marginBottom: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', fontWeight: 700 }}
              onClick={() => setStep(2)}
              disabled={loading}
            >
              <ChevronLeft size={20} style={{ marginRight: 8 }} /> Back to Projects
            </button>
            
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 24 }}>
              3. Customize Your Roadmap
            </h2>
            <p style={{ fontWeight: 600, marginBottom: 24 }}>
              Before generating the roadmap for <strong>{selectedProject.title}</strong>, add any specific technical preferences. You can leave these blank!
            </p>

            <form onSubmit={handleGenerateRoadmap} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Preferred Database (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., PostgreSQL, MongoDB, Firebase..."
                  value={dbPref}
                  onChange={(e) => setDbPref(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Preferred Hosting/Deployment (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Vercel, AWS, Heroku..."
                  value={hostingPref}
                  onChange={(e) => setHostingPref(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Team Size (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Solo, 2-3 people, etc."
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Target Audience (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Developers, Students, Enterprise..."
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Monetization Strategy (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Free Open Source, SaaS, Ads..."
                  value={monetization}
                  onChange={(e) => setMonetization(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label style={{ fontWeight: 600 }}>Additional Requirements (Optional)</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="e.g., Focus heavily on testing, use TypeScript, etc."
                  value={extraPref}
                  onChange={(e) => setExtraPref(e.target.value)}
                />
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ alignSelf: 'flex-start', fontSize: '1.1rem', padding: '12px 32px' }}
                disabled={loading}
              >
                {loading ? (
                  <><span style={{ marginRight: 8, display: 'inline-flex' }}><ButtonSpinner size={18} /></span> Generating...</>
                ) : (
                  <>Generate Roadmap <ArrowRight size={20} style={{ marginLeft: 8 }} /></>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {step === 4 && selectedProject && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <button 
              className="btn" 
              style={{ marginBottom: 24, background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', fontWeight: 700 }}
              onClick={() => setStep(3)}
            >
              <ChevronLeft size={20} style={{ marginRight: 8 }} /> Back to Preferences
            </button>

            <div className="settings-card" style={{ background: 'var(--accent-start)', marginBottom: 32 }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{selectedProject.title}</h2>
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{selectedProject.description}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {roadmap.map((phase, i) => (
                <div key={i} className="settings-card" style={{ background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, background: 'var(--bg-surface)', color: 'var(--bg-card)', fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {phase.phase_number}
                    </div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>
                      {phase.title}
                    </h3>
                  </div>
                  <p style={{ fontWeight: 600, marginBottom: 20, color: 'var(--text-secondary)' }}>
                    {phase.description}
                  </p>
                  
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {phase.tasks.map((task, j) => (
                      <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontWeight: 500 }}>
                        <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
