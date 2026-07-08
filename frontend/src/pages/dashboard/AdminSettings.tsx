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
  prompts?: Record<string, string>;
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({
    maintenance_mode: false,
    allow_new_signups: true,
    nvidia_nim_api_key: '',
    announcement_active: false,
    announcement_message: '',
    announcement_type: 'info',
    prompts: {}
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
            announcement_type: res.data.announcement_type || 'info',
            prompts: res.data.prompts || {}
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
    <div className="dashboard-content" style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
        <SettingsIcon size={32} color="var(--primary)" />
        <div>
          <h1 style={{ margin: 0 }}>System Settings</h1>
          <p style={{ margin: 0, color: 'var(--ink-faint)' }}>Manage global platform configuration.</p>
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
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
          <h3 style={{ margin: 0 }}>General Configuration</h3>
        </div>
        
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Maintenance Mode</div>
              <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>When enabled, normal users will see a maintenance screen.</div>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Allow New Signups</div>
              <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>When disabled, new users cannot register.</div>
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

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              NVIDIA NIM API Key
            </label>
            <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 8 }}>
              Overrides the environment variable if provided. Used for ATS checking and AI features via NVIDIA NIM.
            </div>
            <input 
              type="password" 
              placeholder="nvapi-..."
              value={settings.nvidia_nim_api_key || ''}
              onChange={(e) => setSettings({...settings, nvidia_nim_api_key: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
            />
          </div>

        </div>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 24 }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
          <h3 style={{ margin: 0 }}>System Announcement</h3>
        </div>
        
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Enable Global Announcement</div>
              <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Shows a banner at the top of every page.</div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                  Announcement Message
                </label>
                <textarea 
                  placeholder="E.g., Welcome to the new version!"
                  value={settings.announcement_message}
                  onChange={(e) => setSettings({...settings, announcement_message: e.target.value})}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                  Banner Type (Color)
                </label>
                <select 
                  value={settings.announcement_type}
                  onChange={(e) => setSettings({...settings, announcement_type: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
                >
                  <option value="info">Info (Blue)</option>
                  <option value="success">Success (Green)</option>
                  <option value="warning">Warning (Yellow)</option>
                  <option value="danger">Danger (Red)</option>
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button 
              onClick={handleSave}
              disabled={saving}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, 
                padding: '10px 20px', borderRadius: 8, 
                background: 'var(--primary)', color: 'white', 
                fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 24, marginBottom: 40 }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
          <h3 style={{ margin: 0 }}>Prompt Library</h3>
        </div>
        
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              ATS Checker System Prompt
            </label>
            <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 8 }}>
              Instructions for the AI when evaluating a resume without a Job Description.
            </div>
            <textarea 
              placeholder="Leave blank to use default ATS instructions..."
              value={settings.prompts?.ats_prompt_no_jd || ''}
              onChange={(e) => setSettings({...settings, prompts: {...(settings.prompts || {}), ats_prompt_no_jd: e.target.value}})}
              rows={5}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              Smart Apply Chatbot Prompt
            </label>
            <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 8 }}>
              The core persona and instructions for the Career Advisor AI Chatbot.
            </div>
            <textarea 
              placeholder="Leave blank to use default Chatbot persona..."
              value={settings.prompts?.chatbot_prompt || ''}
              onChange={(e) => setSettings({...settings, prompts: {...(settings.prompts || {}), chatbot_prompt: e.target.value}})}
              rows={5}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button 
              onClick={handleSave}
              disabled={saving}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, 
                padding: '10px 20px', borderRadius: 8, 
                background: 'var(--primary)', color: 'white', 
                fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
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
