import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../api/client';
import '../../styles/dashboard.css';

interface SystemSettings {
  maintenance_mode: boolean;
  allow_new_signups: boolean;
  nvidia_nim_api_key?: string;
  announcement_active: boolean;
  announcement_message: string;
  announcement_type: string;
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({
    maintenance_mode: false,
    allow_new_signups: true,
    nvidia_nim_api_key: '',
    announcement_active: false,
    announcement_message: '',
    announcement_type: 'info'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      setError("Forbidden: You do not have admin access.");
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const res = await apiFetch<SystemSettings>('/admin/settings');
        if (res.ok) {
          setSettings({
            maintenance_mode: res.data.maintenance_mode || false,
            allow_new_signups: res.data.allow_new_signups !== false, // default true
            nvidia_nim_api_key: res.data.nvidia_nim_api_key || '',
            announcement_active: res.data.announcement_active || false,
            announcement_message: res.data.announcement_message || '',
            announcement_type: res.data.announcement_type || 'info'
          });
        } else {
          setError("Failed to fetch settings.");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred fetching settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      const res = await apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError("Failed to save settings.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="dashboard-content flex flex-col items-center justify-center gap-4 h-full">
        <AlertTriangle size={64} color="var(--danger)" />
        <h2>403 Forbidden</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-content flex items-center justify-center h-full">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard-content mx-auto" style={{ maxWidth: 800, padding: 24 }}>
      <header className="flex items-center gap-3 mb-6">
        <SettingsIcon size={32} color="var(--primary)" />
        <div>
          <h1 className="m-0">System Settings</h1>
          <p className="m-0 text-faint">Manage global platform configuration.</p>
        </div>
      </header>

      {error && (
        <div style={{ background: 'var(--danger-faint)', color: 'var(--danger)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{ background: 'var(--success-faint)', color: 'var(--success)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          Settings updated successfully!
        </div>
      )}

      <motion.div 
        className="card card-flush"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
          <h3 className="m-0">General Configuration</h3>
        </div>
        
        <div className="flex flex-col gap-6" style={{ padding: 24 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-ink">Maintenance Mode</div>
              <div className="text-sm text-faint">When enabled, normal users will see a maintenance screen.</div>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.maintenance_mode}
                onChange={(e) => setSettings({...settings, maintenance_mode: e.target.checked})}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-ink">Allow New Signups</div>
              <div className="text-sm text-faint">When disabled, new users cannot register.</div>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.allow_new_signups}
                onChange={(e) => setSettings({...settings, allow_new_signups: e.target.checked})}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <label className="font-semibold text-ink mb-2" style={{ display: 'block' }}>
              NVIDIA NIM API Key
            </label>
            <div className="text-sm text-faint mb-2">
              Overrides the environment variable if provided. Used for ATS checking and AI features via NVIDIA NIM.
            </div>
            <input 
              type="password" 
              placeholder="nvapi-..."
              value={settings.nvidia_nim_api_key || ''}
              onChange={(e) => setSettings({...settings, nvidia_nim_api_key: e.target.value})}
              className="input-field"
            />
          </div>

        </div>
      </motion.div>
      </motion.div>
      <motion.div 
        className="card card-flush mt-6"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
          <h3 className="m-0">System Announcement</h3>
        </div>
        
        <div className="flex flex-col gap-6" style={{ padding: 24 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-ink">Enable Global Announcement</div>
              <div className="text-sm text-faint">Shows a banner at the top of every page.</div>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.announcement_active}
                onChange={(e) => setSettings({...settings, announcement_active: e.target.checked})}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {settings.announcement_active && (
            <div className="flex flex-col gap-4 mt-2">
              <div>
                <label className="font-semibold text-ink mb-2" style={{ display: 'block' }}>
                  Announcement Message
                </label>
                <textarea 
                  placeholder="E.g., Welcome to the new version!"
                  value={settings.announcement_message}
                  onChange={(e) => setSettings({...settings, announcement_message: e.target.value})}
                  rows={3}
                  className="input-field"
                />
              </div>

              <div>
                <label className="font-semibold text-ink mb-2" style={{ display: 'block' }}>
                  Banner Type (Color)
                </label>
                <select 
                  value={settings.announcement_type}
                  onChange={(e) => setSettings({...settings, announcement_type: e.target.value})}
                  className="input-field"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="success">Success (Green)</option>
                  <option value="warning">Warning (Yellow)</option>
                  <option value="danger">Danger (Red)</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
