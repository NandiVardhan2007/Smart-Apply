import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';

import { useToast } from '../components/Toast';
import { apiFetch } from '../api/client';
import '../styles/auth.css';

const stagger = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { label: 'Very Weak', color: 'var(--error)' },
    { label: 'Weak', color: 'var(--warning)' },
    { label: 'Fair', color: 'var(--accent-secondary)' },
    { label: 'Strong', color: 'var(--accent)' },
    { label: 'Very Strong', color: 'var(--success)' },
  ];

  return { score, ...levels[score] };
}

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ message?: string; detail?: string }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      if (res.ok) {
        showToast('success', 'Account created! Check your email for the OTP.');
        navigate('/verify-otp', { state: { email } });
      } else {
        setError((res.data as any).detail || 'Signup failed. Please try again.');
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
          <h2>Create Account</h2>
          <p>Start your AI-powered job search journey</p>
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
            <label htmlFor="signup-name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="signup-name" type="text" className="input-field" style={{ paddingLeft: 42 }}
                placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          </motion.div>

          <motion.div className="input-group" variants={fadeUp}>
            <label htmlFor="signup-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="signup-email" type="email" className="input-field" style={{ paddingLeft: 42 }}
                placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </motion.div>

          <motion.div className="input-group" variants={fadeUp}>
            <label htmlFor="signup-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="signup-password" type={showPassword ? 'text' : 'password'} className="input-field" style={{ paddingLeft: 42, paddingRight: 42 }}
                placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button
                type="button"
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password && (
              <motion.div className="password-strength" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="strength-bar">
                  <motion.div
                    className="strength-fill"
                    style={{ background: strength.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(strength.score + 1) * 20}%` }}
                  />
                </div>
                <div className="strength-label" style={{ color: strength.color }}>{strength.label}</div>
              </motion.div>
            )}
          </motion.div>

          <motion.div className="input-group" variants={fadeUp}>
            <label htmlFor="signup-confirm">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="signup-confirm" type={showConfirmPassword ? 'text' : 'password'} className="input-field" style={{ paddingLeft: 42, paddingRight: 42 }}
                placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              <button
                type="button"
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <motion.button type="submit" className="btn btn-primary" style={{ width: '100%' }}
              disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {loading ? <Loader2 size={20} className="spin" /> : 'Create Account'}
            </motion.button>
          </motion.div>
        </motion.form>

        <div className="auth-links">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>

      </motion.div>
    </div>
  );
}
