import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Mic, Globe, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../api/client';
import { InlineLoader } from '../../components/LoadingSpinner';

interface DashboardStats {
  total_resumes: number;
  total_interviews: number;
  avg_ats_score: number;
  member_since: string;
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiFetch<DashboardStats>('/stats/dashboard');
        if (res.ok && res.data) {
          setStats(res.data);
        }
      } catch (e) {
        console.error("Failed to fetch stats", e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recently';
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return <InlineLoader title="LOADING DASHBOARD..." />;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 40, borderBottom: '4px solid #000', paddingBottom: 24 }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '-0.02em' }}>
          Welcome back, {user?.full_name?.split(' ')[0] || 'User'}!
        </h1>
        <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Here is what is happening with your job search today.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, marginBottom: 40 }}>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ background: 'var(--accent-blue)', padding: 24, border: '4px solid #000', boxShadow: '8px 8px 0px #000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>Resumes</h3>
            <FileText size={24} />
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 900, marginTop: 16 }}>{stats?.total_resumes || 0}</div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          style={{ background: 'var(--accent-pink)', padding: 24, border: '4px solid #000', boxShadow: '8px 8px 0px #000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>Interviews</h3>
            <Mic size={24} />
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 900, marginTop: 16 }}>{stats?.total_interviews || 0}</div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ background: 'var(--accent)', padding: 24, border: '4px solid #000', boxShadow: '8px 8px 0px #000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>Avg ATS</h3>
            <Star size={24} />
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 900, marginTop: 16 }}>{stats?.avg_ats_score || 0}%</div>
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        <div className="card" style={{ border: '4px solid #000', boxShadow: '8px 8px 0px #000' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: 24 }}>Quick Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Link to="/dashboard/ats-checker" className="btn btn-outline" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Check Resume ATS Score <ArrowRight size={18} />
            </Link>
            <Link to="/dashboard/portfolio-generator" className="btn btn-outline" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Generate Portfolio <ArrowRight size={18} />
            </Link>
            <Link to="/dashboard/live-interview" className="btn btn-outline" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Practice Interview <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="card" style={{ border: '4px solid #000', boxShadow: '8px 8px 0px #000' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: 24 }}>Your Profile</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontWeight: 600, fontSize: '1.1rem' }}>
            <p><strong>Member Since:</strong> {formatDate(stats?.member_since)}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p style={{ color: user?.is_verified ? 'var(--success)' : 'var(--error)' }}>
              {user?.is_verified ? '✓ Account Verified' : '⚠ Please verify your email'}
            </p>
            <Link to="/dashboard/profile" className="btn btn-primary" style={{ marginTop: 16, textAlign: 'center' }}>
              Manage Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
