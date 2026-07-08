import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
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

export default function AdminPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
        const [statsRes, usersRes] = await Promise.all([
          apiFetch<AdminStats>('/admin/stats'),
          apiFetch<{ users: AdminUser[] }>('/admin/users')
        ]);
        
        if (statsRes.ok && usersRes.ok) {
          setStats(statsRes.data);
          setUsers(usersRes.data.users);
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, marginBottom: 40 }}>
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

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
          <h3 style={{ margin: 0 }}>Registered Users</h3>
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
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-faint)' }}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
