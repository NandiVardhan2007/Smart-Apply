import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'sa_cookie_consent';

export type ConsentValue = 'accepted' | 'rejected';

/** Read the stored consent choice (null = not yet decided). Other code can call
 *  this before loading any non-essential/analytics script. */
export function getCookieConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'rejected' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Cookie-consent banner. We currently set only strictly-necessary storage
 * (auth token, theme, session id) plus load Google Fonts from a third party;
 * this banner records the visitor's choice so any future non-essential
 * cookies/analytics can be gated on `getCookieConsent() === 'accepted'`.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getCookieConsent() === null) setVisible(true);
  }, []);

  const choose = (value: ConsentValue) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* storage blocked — respect the choice for this session only */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 1000,
        maxWidth: 640,
        margin: '0 auto',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        padding: '18px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Cookie size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
      <p style={{ margin: 0, flex: '1 1 260px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>
        We use only essential storage to keep you signed in and remember your theme. With your
        consent we may also use limited third-party services (e.g. web fonts). See our{' '}
        <Link to="/cookies-policy" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
          Cookie Policy
        </Link>
        .
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => choose('rejected')}
          aria-label="Reject non-essential cookies"
        >
          Reject
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => choose('accepted')}
          aria-label="Accept cookies"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
