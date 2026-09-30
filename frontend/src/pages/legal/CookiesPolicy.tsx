import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../../styles/legal.css';

const UPDATED = 'September 2026';

function Fill({ children }: { children: string }) {
  return <span className="legal-fill">{children}</span>;
}

export default function CookiesPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back"><ArrowLeft size={15} /> Back to home</Link>
        <h1>Cookie Policy</h1>
        <p className="legal-updated">Last updated: {UPDATED}</p>

        <p>
          This Cookie Policy explains how Smart Apply, operated by <Fill>[COMPANY LEGAL NAME]</Fill>, uses
          cookies and similar browser storage. We keep this to a minimum and use only what is needed to
          run the service, plus anything you explicitly consent to.
        </p>

        <h2>1. What we store</h2>
        <p>
          Smart Apply does not use advertising or cross-site tracking cookies. We use a small amount of
          strictly-necessary browser storage:
        </p>
        <ul>
          <li><strong>Authentication token</strong> (<code>sa_token</code>) and an HTTP-only session cookie — to keep you signed in.</li>
          <li><strong>User profile cache</strong> (<code>sa_user</code>) — to display your name and settings without a round-trip.</li>
          <li><strong>Theme preference</strong> (<code>sa_theme</code>) — to remember light/dark/ice mode.</li>
          <li><strong>Session identifier</strong> (<code>sa_session_id</code>) — to route real-time auth events to your tab.</li>
          <li><strong>Cookie choice</strong> (<code>sa_cookie_consent</code>) — to remember your consent decision.</li>
        </ul>
        <p>These are essential for the service to function and cannot be switched off within the app.</p>

        <h2>2. Third-party requests</h2>
        <p>
          We load web fonts from <strong>Google Fonts</strong>, which may share your IP address with Google
          when the page loads. This is the only non-first-party request in the interface.
          <Fill>[We intend to self-host fonts to remove this dependency.]</Fill> We do not embed analytics,
          advertising, or social-media tracking scripts.
        </p>

        <h2>3. Your choices</h2>
        <p>
          When you first visit, we ask for your consent to non-essential use. You can accept or reject via
          the banner; strictly-necessary storage remains active either way because the service cannot work
          without it. You can also clear cookies and site data at any time through your browser settings,
          though doing so will sign you out and reset your preferences.
        </p>

        <h2>4. Changes</h2>
        <p>We will update this policy if our use of cookies changes and revise the "Last updated" date above.</p>

        <h2>5. Contact</h2>
        <p>
          Questions about cookies? Email <Fill>[CONTACT EMAIL]</Fill>. See also our{' '}
          <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
