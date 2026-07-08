import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, AlertTriangle, ShieldCheck, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../api/client';
import '../../styles/dashboard.css';

interface AdminStats {
  total_users: number;
  total_resumes: number;
}



interface TimelineData {
  date: string;
  users: number;
  resumes: number;
}

interface ResumeStatsData {
  scored_resumes: number;
  unscored_resumes: number;
  distribution: { range: string; count: number }[];
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [resumeStats, setResumeStats] = useState<ResumeStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.is_admin) {
      setError("Forbidden: You do not have admin access.");
      setLoading(false);
      return;
    }

    const fetchAdminData = async () => {
      try {
        const [statsRes, timelineRes, resumeStatsRes] = await Promise.all([
          apiFetch<AdminStats>('/admin/stats'),
          apiFetch<{ timeline: TimelineData[] }>('/admin/stats/timeline'),
          apiFetch<ResumeStatsData>('/admin/stats/resumes')
        ]);
        
        if (statsRes.ok && timelineRes.ok && resumeStatsRes.ok) {
          setStats(statsRes.data);
          setTimeline(timelineRes.data.timeline);
          setResumeStats(resumeStatsRes.data);
        } else {
          setError("Failed to fetch admin data.");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred fetching admin data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [user]);



  if (!user?.is_admin) {
    return (
      <div className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <AlertTriangle size={64} color="var(--danger)" />
        <h2>403 Forbidden</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard-content" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
        <ShieldCheck size={32} color="var(--primary)" />
        <div>
          <h1 style={{ margin: 0 }}>System Administration</h1>
          <p style={{ margin: 0, color: 'var(--ink-faint)' }}>Monitor system-wide metrics and user data.</p>
        </div>
      </header>

      {error ? (
        <div style={{ background: 'var(--danger-faint)', color: 'var(--danger)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, marginBottom: 32 }}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--surface)', padding: 24, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-faint)', fontWeight: 600 }}>
            <Users size={18} />
            Total Users
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink)' }}>
            {stats?.total_users || 0}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: 'var(--surface)', padding: 24, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-faint)', fontWeight: 600 }}>
            <FileText size={18} />
            Total Resumes
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink)' }}>
            {stats?.total_resumes || 0}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ background: 'var(--surface)', padding: 24, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 32 }}
      >
        <h3 style={{ margin: '0 0 24px' }}>Platform Growth (Last 30 Days)</h3>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} 
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return `${d.getMonth()+1}/${d.getDate()}`;
                }}
              />
              <YAxis 
                tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} 
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <Tooltip 
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)' }}
                itemStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ paddingTop: 20 }} />
              <Line type="monotone" name="Users Created" dataKey="users" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={3} />
              <Line type="monotone" name="Resumes Uploaded" dataKey="resumes" stroke="#82ca9d" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {resumeStats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ background: 'var(--surface)', padding: 24, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 32 }}
        >
          <h3 style={{ margin: '0 0 8px' }}>ATS Score Distribution</h3>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--ink-faint)' }}>
            Based on {resumeStats.scored_resumes} scored resumes (and {resumeStats.unscored_resumes} unscored).
          </p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resumeStats.distribution} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="range" 
                  tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} 
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis 
                  tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} 
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip 
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)' }}
                  itemStyle={{ fontWeight: 600 }}
                  cursor={{ fill: 'var(--surface-sunken)' }}
                />
                <Bar name="Number of Resumes" dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
}
