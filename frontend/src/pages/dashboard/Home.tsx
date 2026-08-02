import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Mic, Star, ArrowRight, ScanSearch, Wand2, Video, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../api/client';
import { SkeletonCard } from '../../components/LoadingSpinner';
import PageHeader from '../../components/PageHeader';
import type { DashboardStats } from '../../api/types';

const STAT_CARDS = [
  { key: 'total_resumes' as const, label: 'Resumes', icon: FileText, suffix: '' },
  { key: 'total_interviews' as const, label: 'Interviews practiced', icon: Mic, suffix: '' },
  { key: 'avg_ats_score' as const, label: 'Average ATS score', icon: Star, suffix: '%' },
];

const QUICK_ACTIONS = [
  { to: '/dashboard/ats-checker', label: 'Check resume ATS score', icon: ScanSearch },
  { to: '/dashboard/resumes', label: 'Tailor a resume', icon: Wand2 },
  { to: '/dashboard/idea-prompt-generator', label: 'Idea Prompt Studio (Unstructured to Prompt)', icon: Wand2 },
  { to: '/dashboard/live-interview', label: 'Practice a live interview', icon: Video },
];

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<DashboardStats>('/stats/dashboard');
        if (res.ok) setStats(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Recently';
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="container">
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'there'}`}
        subtitle="Here's what's happening with your job search today."
      />

      {/* Stat Cards */}
      <div className="grid-auto-fit" style={{ marginBottom: 28 }}>
        {loading
          ? STAT_CARDS.map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <SkeletonCard variant="stat" />
              </motion.div>
            ))
          : STAT_CARDS.map((stat, i) => (
              <motion.div
                key={stat.key}
                className="card"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="eyebrow">{stat.label}</span>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'var(--accent-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <stat.icon size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                </div>
                <div className="stat-number" style={{ fontSize: 40, marginTop: 12 }}>
                  {stats?.[stat.key] ?? 0}
                  {stat.suffix}
                </div>
              </motion.div>
            ))}
      </div>

      {/* Bottom Grid */}
      <div className="grid-auto-fit">
        {loading ? (
          <>
            <SkeletonCard variant="card" />
            <SkeletonCard variant="card" />
          </>
        ) : (
          <>
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 style={{ fontSize: 17, marginBottom: 18 }}>Quick actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="btn btn-outline"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <action.icon size={16} />
                      {action.label}
                    </span>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h2 style={{ fontSize: 17, marginBottom: 18 }}>Your account</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                  <span className="text-muted">Member since</span>
                  <span style={{ fontWeight: 600 }}>{formatDate(stats?.member_since)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                  <span className="text-muted">Email</span>
                  <span style={{ fontWeight: 600, wordBreak: 'break-all' }}>{user?.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: user?.is_verified ? 'var(--success)' : 'var(--warning)' }}>
                  {user?.is_verified ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span style={{ fontWeight: 600 }}>
                    {user?.is_verified ? 'Account verified' : 'Please verify your email'}
                  </span>
                </div>
                <Link to="/dashboard/profile" className="btn btn-primary" style={{ marginTop: 8, justifyContent: 'center' }}>
                  Manage profile
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
