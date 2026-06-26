import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { apiFetch } from '../api/client';
import '../styles/auth.css';

export default function OtpVerify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, lastAuthEvent } = useAuth();
  const { showToast } = useToast();
  const email = (location.state as any)?.email || '';

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Listen for WebSocket otp_verified event
  useEffect(() => {
    if (lastAuthEvent?.type === 'otp_verified' && lastAuthEvent.data.token) {
      setSuccess(true);
      setTimeout(() => navigate(lastAuthEvent.data.has_onboarded ? '/dashboard/resumes' : '/onboarding'), 1000);
    }
    if (lastAuthEvent?.type === 'otp_failed') {
      setError(lastAuthEvent.data.reason as string || 'Invalid OTP');
    }
  }, [lastAuthEvent, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await apiFetch<{
        access_token: string;
        user: any;
        detail?: string;
      }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp_code: code }),
      });

      if (res.ok) {
        login(res.data.access_token, res.data.user);
        setSuccess(true);
        showToast('success', 'Email verified successfully!');
        setTimeout(() => navigate(res.data.user.has_onboarded ? '/dashboard/resumes' : '/onboarding'), 1000);
      } else {
        setError((res.data as any).detail || 'Invalid OTP');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await apiFetch('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setCountdown(60);
      showToast('info', 'A new OTP has been sent to your email.');
    } catch {
      showToast('error', 'Failed to resend OTP.');
    }
  };

  if (!email) {
    navigate('/signup');
    return null;
  }

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
          <h2>Verify Your Email</h2>
          <p>
            We've sent a 6-digit code to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
          </p>
        </div>

        {error && (
          <motion.div
            className="auth-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        )}

        {success ? (
          <motion.div
            style={{ textAlign: 'center', padding: 32 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <CheckCircle size={64} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Verified!</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Redirecting to dashboard...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="otp-inputs" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <motion.input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className={`otp-input ${digit ? 'filled' : ''}`}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                />
              ))}
            </div>

            <motion.button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? <Loader2 size={20} className="spin" /> : 'Verify Code'}
            </motion.button>

            <div className="resend-section">
              {countdown > 0 ? (
                <span>Resend code in <strong>{countdown}s</strong></span>
              ) : (
                <button type="button" className="resend-btn" onClick={handleResend}>
                  Resend Code
                </button>
              )}
            </div>
          </form>
        )}

        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </div>
  );
}
