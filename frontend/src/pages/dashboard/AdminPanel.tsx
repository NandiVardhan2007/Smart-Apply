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

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
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
  const [users, setUsers] = useState<AdminUser[]>([]);
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
        const [statsRes, usersRes, timelineRes, resumeStatsRes] = await Promise.all([
          apiFetch<AdminStats>('/admin/stats'),
          apiFetch<{ users: AdminUser[] }>('/admin/users'),
          apiFetch<{ timeline: TimelineData[] }>('/admin/stats/timeline'),
          apiFetch<ResumeStatsData>('/admin/stats/resumes')
        ]);
        
        if (statsRes.ok && usersRes.ok && timelineRes.ok && resumeStatsRes.ok) {
          setStats(statsRes.data);
          setUsers(usersRes.data.users);
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

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (userId === user?.id) {
      alert("You cannot change your own admin role.");
      return;
    }
    try {
      const res = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ is_admin: !currentStatus })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !currentStatus } : u));
      } else {
        alert("Failed to update role");
      }
    } catch (err) {
      console.error("Failed to toggle admin role", err);
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === user?.id) {
      alert("You cannot delete yourself.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      const res = await apiFetch(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      console.error("Failed to delete user", err);
    }
  };

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

      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
          <h3 style={{ margin: 0 }}>User Management</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '12px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem' }}>Email</th>
                <th style={{ padding: '12px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '12px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem' }}>Admin</th>
                <th style={{ padding: '12px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem' }}>Joined</th>
                <th style={{ padding: '12px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 500 }}>{u.full_name || '—'}</td>
                  <td style={{ padding: '16px 24px', color: 'var(--ink-faint)' }}>{u.email}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600,
                      background: u.is_verified ? 'var(--success-faint)' : 'var(--danger-faint)',
                      color: u.is_verified ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {u.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {u.is_admin ? (
                      <span style={{ background: 'var(--primary-faint)', color: 'var(--primary)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>Admin</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontSize: '0.9rem' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => toggleAdmin(u.id, u.is_admin)} 
                        title={u.is_admin ? "Remove Admin" : "Make Admin"}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}
                      >
                        {u.is_admin ? <UserMinus size={16} /> : <UserPlus size={16} />}
                      </button>
                      <button 
                        onClick={() => deleteUser(u.id)} 
                        title="Delete User"
                        style={{ background: 'var(--danger-faint)', border: '1px solid transparent', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-faint)' }}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
