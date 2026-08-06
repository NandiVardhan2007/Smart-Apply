import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, Trash2, UserPlus, UserMinus, ShieldCheck, Download, Settings, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, getApiBaseUrl } from '../../api/client';
import { useToast } from '../../components/Toast';
import { AnimatePresence } from 'framer-motion';
import '../../styles/dashboard.css';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
  features: Record<string, boolean>;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [editingFeaturesUser, setEditingFeaturesUser] = useState<AdminUser | null>(null);
  const [tempFeatures, setTempFeatures] = useState<Record<string, boolean>>({});
  const [savingFeatures, setSavingFeatures] = useState(false);

  const { showToast } = useToast();
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.is_admin) {
      setError("Forbidden: You do not have admin access.");
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ users: AdminUser[], total: number }>(`/admin/users?page=${page}&page_size=${pageSize}`);
        if (res.ok) {
          setUsers(res.data.users);
          setTotal(res.data.total);
        } else {
          setError("Failed to fetch users.");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred fetching users.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user, page, pageSize]);

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (userId === user?.id) {
      showToast('error', "You cannot change your own admin role.");
      return;
    }
    try {
      const res = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ is_admin: !currentStatus })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !currentStatus } : u));
        showToast('success', "Role updated successfully.");
      } else {
        showToast('error', "Failed to update role");
      }
    } catch (err) {
      console.error("Failed to toggle admin role", err);
      showToast('error', "Failed to toggle admin role");
    }
  };

  const confirmDeleteUser = (userId: string) => {
    if (userId === user?.id) {
      showToast('error', "You cannot delete yourself.");
      return;
    }
    setDeletingUserId(userId);
  };

  const deleteUser = async () => {
    if (!deletingUserId) return;
    try {
      const res = await apiFetch(`/admin/users/${deletingUserId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== deletingUserId));
        showToast('success', 'User deleted successfully.');
      } else {
        showToast('error', "Failed to delete user");
      }
    } catch (err) {
      console.error("Failed to delete user", err);
      showToast('error', "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem('sa_token');
      const res = await fetch(`${getApiBaseUrl('/admin/export/users')}/admin/export/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartapply_users_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('success', 'Export successful.');
      } else {
        showToast('error', "Failed to export users");
      }
    } catch (err) {
      console.error(err);
      showToast('error', "Failed to export users");
    }
  };

  const handleEditFeatures = (user: AdminUser) => {
    setEditingFeaturesUser(user);
    setTempFeatures(user.features || {
      "ats_checker": true,
      "ai_chatbot": true,
      "cover_letter_writer": true,
      "interview_prep": true,
      "roadmap_generator": true
    });
  };

  const saveFeatures = async () => {
    if (!editingFeaturesUser) return;
    setSavingFeatures(true);
    try {
      const res = await apiFetch(`/admin/users/${editingFeaturesUser.id}/features`, {
        method: 'PUT',
        body: JSON.stringify({ features: tempFeatures })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === editingFeaturesUser.id ? { ...u, features: tempFeatures } : u));
        setEditingFeaturesUser(null);
        showToast('success', 'Features updated successfully.');
      } else {
        showToast('error', "Failed to update features.");
      }
    } catch (err) {
      console.error(err);
      showToast('error', "Failed to update features.");
    } finally {
      setSavingFeatures(false);
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
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={32} color="var(--primary)" />
          <div>
            <h1 style={{ margin: 0 }}>User Management</h1>
            <p style={{ margin: 0, color: 'var(--ink-faint)' }}>View, promote, and manage system users.</p>
          </div>
        </div>
        <button 
          onClick={handleExportCsv}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            padding: '10px 16px', borderRadius: 8, 
            background: 'var(--surface-sunken)', color: 'var(--ink)', 
            fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer'
          }}
        >
          <Download size={18} /> Export CSV
        </button>
      </header>

      {error ? (
        <div style={{ background: 'var(--danger-faint)', color: 'var(--danger)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                  <th style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin</th>
                  <th style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</th>
                  <th style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}>
                          <ShieldCheck size={18} style={{ flexShrink: 0 }} /> Admin
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>User</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--ink-faint)', fontSize: '0.85rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => handleEditFeatures(u)}
                          title="Manage Features"
                          style={{ 
                            background: 'var(--surface-sunken)', color: 'var(--ink)',
                            border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap'
                          }}
                        >
                          <Settings size={18} style={{ flexShrink: 0 }} /> Features
                        </button>
                        <button 
                          onClick={() => toggleAdmin(u.id, u.is_admin)}
                          title={u.is_admin ? "Remove Admin" : "Make Admin"}
                          style={{ 
                            background: u.is_admin ? 'var(--warning-faint)' : 'var(--primary-faint)', 
                            color: u.is_admin ? 'var(--warning)' : 'var(--primary)',
                            border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap'
                          }}
                        >
                          {u.is_admin ? <UserMinus size={18} style={{ flexShrink: 0 }} /> : <UserPlus size={18} style={{ flexShrink: 0 }} />}
                          {u.is_admin ? 'Demote' : 'Promote'}
                        </button>
                        <button 
                          onClick={() => confirmDeleteUser(u.id)}
                          title="Delete User"
                          className="btn-action btn-action-danger"
                        >
                          <Trash2 size={18} style={{ flexShrink: 0 }} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>
              Showing {users.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, total)} of {total} users
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="btn-sm"
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: page === 1 ? 'var(--surface-sunken)' : 'var(--surface)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => p + 1)} 
                disabled={page * pageSize >= total}
                className="btn-sm"
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: page * pageSize >= total ? 'var(--surface-sunken)' : 'var(--surface)', cursor: page * pageSize >= total ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {editingFeaturesUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: 'var(--surface)', padding: 32, borderRadius: 16, width: '100%', maxWidth: 450,
            border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Manage Entitlements</h2>
              <button 
                onClick={() => setEditingFeaturesUser(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ margin: '0 0 24px', color: 'var(--ink-faint)', fontSize: '0.9rem' }}>
              Toggle features for <strong>{editingFeaturesUser.email}</strong>. 
              These changes take effect immediately on their next page load.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              {Object.keys(tempFeatures).map(feat => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ textTransform: 'capitalize', fontWeight: 500, color: 'var(--ink)' }}>
                    {feat.replace(/_/g, ' ')}
                  </div>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={tempFeatures[feat]}
                      onChange={(e) => setTempFeatures({...tempFeatures, [feat]: e.target.checked})}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setEditingFeaturesUser(null)}
                style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--surface-sunken)', color: 'var(--ink)', border: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={saveFeatures}
                disabled={savingFeatures}
                style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: savingFeatures ? 'not-allowed' : 'pointer', opacity: savingFeatures ? 0.7 : 1 }}
              >
                {savingFeatures ? 'Saving...' : 'Save Features'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {deletingUserId && (
          <div className="modal-overlay" onClick={() => setDeletingUserId(null)}>
            <motion.div
              className="modal"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              tabIndex={-1}
            >
              <h3 id="delete-user-title" style={{ fontSize: 18, marginBottom: 10 }}>Delete User?</h3>
              <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>
                Are you sure you want to delete this user? All their data, resumes, and interview history will be permanently erased.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary btn-block" onClick={() => setDeletingUserId(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger btn-block" onClick={deleteUser} autoFocus>
                  Yes, delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
