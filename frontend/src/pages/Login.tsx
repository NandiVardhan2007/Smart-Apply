import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { apiFetch } from '../api/client';
import '../styles/auth.css';

const stagger = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch<{
        access_token: string;
        user: { id: string; email: string; full_name: string; is_verified: boolean; profile_pic_url: string | null; has_onboarded: boolean };
        detail?: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        login(res.data.access_token, res.data.user);
        showToast('success', 'Welcome back!');
        
        if (!res.data.user.has_onboarded) {
          navigate('/onboarding');
        } else {
          navigate('/dashboard/resumes');
        }
      } else if (res.status === 403) {
        // Email not verified — redirect to OTP
        showToast('info', 'Please verify your email first.');
        navigate('/verify-otp', { state: { email } });
      } else {
        setError((res.data as any).detail || 'Invalid email or password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img src="/logo.svg" alt="Smart Apply Logo" style={{ height: '48px', objectFit: 'contain' }} />
        </div>
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Sign in to your account to continue</p>
        </div>

        {error && (
          <motion.div
            className="auth-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            {error}
          </motion.div>
        )}

        <motion.form
          className="auth-form"
          onSubmit={handleSubmit}
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <motion.div className="input-group" variants={fadeUp}>
            <label htmlFor="login-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="login-email"
                type="email"
                className="input-field"
                style={{ paddingLeft: 42 }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </motion.div>

          <motion.div className="input-group" variants={fadeUp}>
            <label htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                style={{ paddingLeft: 42, paddingRight: 42 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Link to="/reset-password" className="forgot-link">
              Forgot password?
            </Link>
          </motion.div>

          <motion.div variants={fadeUp}>
            <motion.button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? <Loader2 size={20} className="spin" /> : 'Sign In'}
            </motion.button>
          </motion.div>
        </motion.form>

        <div className="auth-links">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>


      </motion.div>
    </div>
  );
}
