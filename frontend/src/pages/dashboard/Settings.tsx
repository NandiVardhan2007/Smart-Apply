import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Lock, AlertTriangle, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { apiFetch } from '../../api/client';

export default function Settings() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sa_theme') === 'dark');
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) return showToast('error', 'New password must be at least 8 characters');
    try {
      const res = await apiFetch<{ detail?: string }>('/user/settings/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw })
      });
      if (res.ok) {
        showToast('success', 'Password updated successfully');
        setCurrentPw('');
        setNewPw('');
      } else {
        showToast('error', res.data?.detail || 'Failed to update password');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error while updating password');
    }
  };

  return (
    <div className="settings-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="dashboard-page-header">
        <h1>Settings</h1>
        <p>Manage your account preferences and security</p>
      </div>

      <div className="settings-sections">
        {/* Account Info Summary */}
        <div className="settings-card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, background: 'var(--accent-pink)' }}>
          <div style={{ width: 64, height: 64, background: 'var(--accent)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 900, color: '#000', boxShadow: 'var(--shadow-sm)' }}>
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 900, textTransform: 'uppercase' }}>{user?.full_name}</h2>
            <p style={{ color: '#000', margin: '4px 0 0', fontWeight: 600 }}>{user?.email}</p>
          </div>
        </div>

        {/* Security */}
        <div className="settings-card">
          <h3><Shield size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} /> Security</h3>
          <form className="settings-form" onSubmit={handleUpdatePassword}>
            <div className="input-group">
              <label>Current Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  style={{ paddingLeft: 40, paddingRight: 40 }}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  required
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="input-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  style={{ paddingLeft: 40, paddingRight: 40 }}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <button type="submit" className="btn btn-primary" disabled={!currentPw || !newPw}>Update Password</button>
            </div>
          </form>
        </div>

        {/* Preferences */}
        <div className="settings-card">
          <h3><Bell size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} /> Preferences</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Email Notifications</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Receive updates on product features and career tips</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={notifications} onChange={async (e) => {
                const val = e.target.checked;
                setNotifications(val);
                localStorage.setItem('sa_notifications', String(val));
                try {
                  await apiFetch('/user/profile', {
                    method: 'PUT',
                    body: JSON.stringify({ notifications_enabled: val })
                  });
                } catch(err) {
                  // Ignore backend failure if field doesn't exist
                }
              }} />
              <span className="slider"></span>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Dark Mode</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Use a darker theme for the dashboard</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={darkMode} onChange={(e) => {
                const val = e.target.checked;
                setDarkMode(val);
                if (val) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  localStorage.setItem('sa_theme', 'dark');
                } else {
                  document.documentElement.removeAttribute('data-theme');
                  localStorage.removeItem('sa_theme');
                }
              }} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-card danger-zone" style={{ background: '#ffeded', border: '3px solid var(--error)', boxShadow: '4px 4px 0px var(--error)' }}>
          <h3><AlertTriangle size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px', color: 'var(--error)' }} /> <span style={{ color: 'var(--error)', fontWeight: 900, textTransform: 'uppercase' }}>Danger Zone</span></h3>
          <p style={{ fontSize: '0.9rem', color: '#000', marginBottom: 16, fontWeight: 600 }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button className="btn" style={{ background: 'var(--error)', color: '#fff', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', fontWeight: 900 }} onClick={() => setShowDeleteModal(true)}>
            DELETE ACCOUNT
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="modal-overlay">
            <motion.div
              className="modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>Delete Account?</h3>
              <p style={{ marginBottom: 24, fontWeight: 500 }}>Are you sure you want to delete your account? All your data, resumes, and interview history will be permanently erased.</p>
              <div className="modal-actions" style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, background: 'var(--error)' }} onClick={async () => {
                  try {
                    const res = await apiFetch<{ detail?: string }>('/user/account', { method: 'DELETE' });
                    if (res.ok) {
                      showToast('info', 'Account scheduled for deletion.');
                      logout();
                    } else {
                      showToast('error', res.data?.detail || 'Failed to delete account');
                    }
                  } catch (err: any) {
                    showToast('error', err.message || 'Network error while deleting account');
                  }
                }}>
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <style>{`
        .toggle-switch { position: relative; display: inline-block; width: 48px; height: 28px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #fff; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); transition: .4s; border-radius: 0; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: #000; transition: .4s; border-radius: 0; }
        input:checked + .slider { background-color: var(--success); }
        input:checked + .slider:before { transform: translateX(20px); background-color: #fff; border: 1px solid var(--border-color); bottom: 1px; left: 1px; height: 20px; width: 20px; }
      `}</style>
    </div>
  );
}
