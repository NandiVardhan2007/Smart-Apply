import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, CheckCircle } from 'lucide-react';

import { useToast } from '../components/Toast';
import { apiFetch } from '../api/client';
import '../styles/auth.css';

const fadeSlide = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

export default function ResetPassword() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        showToast('info', 'If this email is registered, an OTP has been sent.');
        setStep(2);
      } else {
        setError((res.data as any).detail || 'Something went wrong');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }),
      });
      if (res.ok) {
        setStep(3);
        showToast('success', 'Password reset successfully!');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError((res.data as any).detail || 'Invalid OTP or error');
      }
    } catch {
      setError('Network error');
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

        {/* Step indicator */}
        <div className="step-indicator">
          <div className={`step-dot ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`} />
          <div className={`step-line ${step >= 2 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`} />
          <div className={`step-line ${step >= 3 ? 'active' : ''}`} />
          <div className={`step-dot ${step >= 3 ? 'active' : ''}`} />
        </div>

        {error && (
          <motion.div className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" {...fadeSlide}>
              <div className="auth-header">
                <h2>Reset Password</h2>
                <p>Enter your email to receive a verification code</p>
              </div>
              <form className="auth-form" onSubmit={handleSendOtp}>
                <div className="input-group">
                  <label htmlFor="reset-email">Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input id="reset-email" type="email" className="input-field" style={{ paddingLeft: 42 }}
                      placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <motion.button type="submit" className="btn btn-primary" style={{ width: '100%' }}
                  disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {loading ? <Loader2 size={20} className="spin" /> : 'Send OTP'}
                </motion.button>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" {...fadeSlide}>
              <div className="auth-header">
                <h2>Enter Code & New Password</h2>
                <p>Check your email for the verification code</p>
              </div>
              <form className="auth-form" onSubmit={handleReset}>
                <div className="input-group">
                  <label htmlFor="reset-otp">Verification Code</label>
                  <input id="reset-otp" type="text" className="input-field" inputMode="numeric"
                    placeholder="6-digit code" maxLength={6} value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} required />
                </div>
                <div className="input-group">
                  <label htmlFor="reset-new-pw">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input id="reset-new-pw" type="password" className="input-field" style={{ paddingLeft: 42 }}
                      placeholder="Min. 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  </div>
                </div>
                <motion.button type="submit" className="btn btn-primary" style={{ width: '100%' }}
                  disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {loading ? <Loader2 size={20} className="spin" /> : 'Reset Password'}
                </motion.button>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" {...fadeSlide} style={{ textAlign: 'center', padding: '32px 0' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <CheckCircle size={64} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
              </motion.div>
              <h2 style={{ marginBottom: 8 }}>Password Reset!</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Redirecting to login...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="auth-links">
          Remember your password? <Link to="/login">Sign in</Link>
        </div>

      </motion.div>
    </div>
  );
}
