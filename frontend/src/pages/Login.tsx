import { signInWithCustomToken, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { ButtonSpinner } from '../components/LoadingSpinner';
import ThemeToggleFloating from '../components/ThemeToggleFloating';
import { apiFetch, apiErrorMessage } from '../api/client';
import type { User } from '../api/types';
import '../styles/auth.css';

interface LoginResponse {
  access_token: string;
  user: User;
  detail?: string;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  // Handle the result when user returns from Google redirect
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return; // No redirect result (normal page load)
        setLoading(true);
        try {
          const token = await result.user.getIdToken();
          const res = await apiFetch<User>('/auth/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            showToast('success', `Welcome back, ${res.data.full_name.split(' ')[0]}!`);
            navigate(res.data.has_onboarded ? '/dashboard' : '/onboarding');
          } else {
            setError(apiErrorMessage(res, 'Failed to sync Google account.'));
            await auth.signOut();
          }
        } catch {
          setError('Google sign-in failed. Please try again.');
        } finally {
          setLoading(false);
        }
      })
      .catch((e: any) => {
        if (e.code !== 'auth/popup-closed-by-user') {
          setError('Google sign-in failed. Please try again.');
        }
      });
  }, [navigate, showToast]);

  const handleGoogleLogin = () => {
    setError('');
    signInWithRedirect(auth, googleProvider);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        await signInWithCustomToken(auth, res.data.access_token);
        showToast('success', `Welcome back, ${res.data.user.full_name.split(' ')[0]}!`);
        navigate(res.data.user.has_onboarded ? '/dashboard' : '/onboarding');
      } else if (res.status === 403) {
        showToast('info', 'Please verify your email first.');
        navigate('/verify-otp', { state: { email } });
      } else {
        setError(apiErrorMessage(res, 'Invalid email or password.'));
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <ThemeToggleFloating />
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="Smart Apply" style={{ height: 42, width: 42, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.025em', color: 'var(--ink)' }}>
              Smart<span style={{ color: 'var(--accent)' }}>Apply</span>
            </span>
          </Link>
        </div>

        <div className="auth-header">
          <h2>Welcome back</h2>
          <p>Sign in to keep working on your job search</p>
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            {error}
          </motion.div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="login-email">Email</label>
            <div className="input-icon-wrap">
              <Mail size={17} />
              <input
                id="login-email"
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="login-password">Password</label>
            <div className="input-icon-wrap">
              <Lock size={17} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input-field has-trailing"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="input-icon-trailing"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <Link to="/reset-password" className="forgot-link">
            Forgot password?
          </Link>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <ButtonSpinner /> : 'Sign in'}
          </button>

          <div className="auth-divider" style={{ margin: '20px 0', textAlign: 'center', position: 'relative' }}>
            <span style={{ backgroundColor: 'var(--surface)', padding: '0 10px', color: 'var(--ink-light)', fontSize: '0.9rem', position: 'relative', zIndex: 1 }}>or</span>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: 'var(--border)' }}></div>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-block btn-lg"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </form>

        <div className="auth-links">
          New to Smart Apply? <Link to="/signup">Create an account</Link>
        </div>
      </motion.div>
    </div>
  );
}
