import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, Clock, Star, ArrowRight, ChevronLeft, CheckCircle2, Lightbulb } from 'lucide-react';

import { InlineLoader, ButtonSpinner } from '../../components/LoadingSpinner';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';
import type { Project, RoadmapPhase } from '../../api/types';

export default function ProjectRecommender() {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);

  const [skills, setSkills] = useState('');
  const [timeCommitment, setTimeCommitment] = useState('');
  const [interests, setInterests] = useState('');

  const [dbPref, setDbPref] = useState('');
  const [hostingPref, setHostingPref] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [monetization, setMonetization] = useState('');
  const [extraPref, setExtraPref] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapPhase[]>([]);

  const handleGetRecommendations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skills || !timeCommitment || !interests) {
      showToast('error', 'Please fill out all fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<Project[]>('/projects/recommend', {
        method: 'POST',
        body: JSON.stringify({ skills, time_commitment: timeCommitment, interests }),
      });

      if (res.ok && res.data) {
        setProjects(res.data);
        setStep(2);
      } else {
        showToast('error', 'Failed to get recommendations.');
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareRoadmap = (project: Project) => {
    setSelectedProject(project);
    setStep(3);
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
            'Preferred Database': dbPref,
            'Preferred Hosting': hostingPref,
            'Team Size': teamSize,
            'Target Audience': targetAudience,
            'Monetization Strategy': monetization,
            'Additional Requirements': extraPref,
          },
        }),
      });

      if (res.ok && res.data?.phases) {
        setRoadmap(res.data.phases);
        setStep(4);
      } else {
        showToast('error', 'Failed to generate roadmap.');
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-narrow">
      <div className="dashboard-page-header">
        <h1>Project finder</h1>
        <p>Get AI-tailored software project recommendations and step-by-step roadmaps.</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="card">
            <span className="eyebrow">Step 1 of 2</span>
            <h2 style={{ fontSize: 19, marginTop: 6, marginBottom: 22 }}>Tell us about yourself</h2>
            <form onSubmit={handleGetRecommendations} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="input-group">
                <label>Current skills &amp; technologies</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. React, Python basics, Tailwind"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Available time</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 10 hours a week, or 1 month total"
                  value={timeCommitment}
                  onChange={(e) => setTimeCommitment(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Interests &amp; goals</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="e.g. I want to build a SaaS, I like AI, I want to learn databases…"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }} disabled={loading}>
                {loading ? (
                  <>
                    <ButtonSpinner /> Analyzing…
                  </>
                ) : (
                  <>
                    Find projects <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }} onClick={() => setStep(1)} disabled={loading}>
              <ChevronLeft size={15} /> Back
            </button>

            <h2 style={{ fontSize: 19, marginBottom: 20 }}>Recommended for you</h2>

            {loading ? (
              <InlineLoader title="Finding your projects" subtitle="Matching ideas to your skills and interests" />
            ) : (
              <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {projects.map((proj) => (
                  <div key={proj.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                      <h3 style={{ fontSize: 16 }}>{proj.title}</h3>
                      <span className="badge badge-accent" style={{ flexShrink: 0 }}>
                        <Star size={11} /> {proj.rating}/10
                      </span>
                    </div>

                    <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 16, flex: 1, lineHeight: 1.55 }}>
                      {proj.description}
                    </p>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span className="badge">
                        <Code2 size={12} /> {proj.skill_level}
                      </span>
                      <span className="badge">
                        <Clock size={12} /> {proj.estimated_time}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                      {proj.key_technologies.map((tech) => (
                        <span key={tech} className="badge badge-accent">
                          {tech}
                        </span>
                      ))}
                    </div>

                    <button className="btn btn-primary btn-block" onClick={() => handlePrepareRoadmap(proj)}>
                      Generate roadmap
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {step === 3 && selectedProject && (
          <motion.div key="step3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="card">
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }} onClick={() => setStep(2)} disabled={loading}>
              <ChevronLeft size={15} /> Back to projects
            </button>

            <span className="eyebrow">Step 2 of 2</span>
            <h2 style={{ fontSize: 19, marginTop: 6, marginBottom: 10 }}>Customize your roadmap</h2>
            <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 22 }}>
              Before generating the plan for <strong style={{ color: 'var(--ink)' }}>{selectedProject.title}</strong>, add any
              preferences — all optional.
            </p>

            <form onSubmit={handleGenerateRoadmap} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="input-group">
                <label>Preferred database</label>
                <input type="text" className="input-field" placeholder="e.g. PostgreSQL, MongoDB, Firebase" value={dbPref} onChange={(e) => setDbPref(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Preferred hosting / deployment</label>
                <input type="text" className="input-field" placeholder="e.g. Vercel, AWS, Render" value={hostingPref} onChange={(e) => setHostingPref(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Team size</label>
                <input type="text" className="input-field" placeholder="e.g. Solo, 2–3 people" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Target audience</label>
                <input type="text" className="input-field" placeholder="e.g. Developers, students, enterprise" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Monetization strategy</label>
                <input type="text" className="input-field" placeholder="e.g. Open source, SaaS, ads" value={monetization} onChange={(e) => setMonetization(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Additional requirements</label>
                <textarea className="input-field" rows={3} placeholder="e.g. Focus on testing, use TypeScript" value={extraPref} onChange={(e) => setExtraPref(e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }} disabled={loading}>
                {loading ? (
                  <>
                    <ButtonSpinner /> Generating…
                  </>
                ) : (
                  <>
                    Generate roadmap <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {step === 4 && selectedProject && (
          <motion.div key="step4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }} onClick={() => setStep(3)}>
              <ChevronLeft size={15} /> Back to preferences
            </button>

            <div className="card" style={{ marginBottom: 24, borderColor: 'var(--accent-soft-border)', background: 'var(--accent-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Lightbulb size={16} style={{ color: 'var(--accent)' }} />
                <span className="eyebrow" style={{ color: 'var(--accent)' }}>Your roadmap</span>
              </div>
              <h2 style={{ fontSize: 21, marginBottom: 6 }}>{selectedProject.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{selectedProject.description}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {roadmap.map((phase, i) => (
                <div key={i} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: 'var(--accent-ink)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {phase.phase_number}
                    </div>
                    <h3 style={{ fontSize: 16 }}>{phase.title}</h3>
                  </div>
                  <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 16 }}>{phase.description}</p>

                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {phase.tasks.map((task, j) => (
                      <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5 }}>
                        <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
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
