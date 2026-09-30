import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../../styles/legal.css';

const UPDATED = 'September 2026';

function Fill({ children }: { children: string }) {
  return <span className="legal-fill">{children}</span>;
}

export default function TermsConditions() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back"><ArrowLeft size={15} /> Back to home</Link>
        <h1>Terms &amp; Conditions</h1>
        <p className="legal-updated">Last updated: {UPDATED}</p>

        <p>
          These Terms govern your use of Smart Apply, operated by <Fill>[COMPANY LEGAL NAME]</Fill>.
          By creating an account or using the service, you agree to these Terms. If you do not agree,
          please do not use the service.
        </p>

        <h2>1. Eligibility</h2>
        <p>You must be at least 18 years old and able to form a binding contract to use Smart Apply.</p>

        <h2>2. Your account</h2>
        <p>
          You are responsible for the accuracy of the information you provide and for keeping your
          credentials confidential. You are responsible for activity that occurs under your account.
          Notify us promptly of any unauthorized use.
        </p>

        <h2>3. Acceptable use</h2>
        <ul>
          <li>Do not use the service unlawfully or to infringe others' rights.</li>
          <li>Do not upload content you do not have the right to use, or that is unlawful, harmful, or misleading.</li>
          <li>Do not attempt to disrupt, reverse-engineer, scrape, or gain unauthorized access to the service.</li>
          <li>Do not misuse AI features to generate deceptive, fraudulent, or discriminatory content.</li>
        </ul>

        <h2>4. AI-generated content</h2>
        <p>
          Smart Apply uses AI to produce resumes, cover letters, scores, suggestions, and interview
          feedback. These outputs are generated automatically and may be inaccurate or incomplete. They
          are provided for your assistance only and are <strong>not</strong> professional, legal, career,
          or employment advice. You are responsible for reviewing and verifying any content before you
          rely on or submit it.
        </p>

        <h2>5. Your content and license</h2>
        <p>
          You retain ownership of the resumes, documents, and information you submit. You grant us a
          limited license to process and store that content solely to provide the service to you, as
          described in our <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>

        <h2>6. Third-party services</h2>
        <p>
          The service relies on third-party providers (AI inference, email, storage, job-search data,
          hosting). Their availability and results are outside our control, and their own terms may apply.
        </p>

        <h2>7. Service availability</h2>
        <p>
          We aim to keep the service available but do not guarantee uninterrupted or error-free operation.
          Features may change, and we may suspend or discontinue parts of the service with reasonable notice
          where practicable.
        </p>

        <h2>8. Fees</h2>
        <p><Fill>[Describe any paid plans, billing, and refund terms — or state the service is currently free.]</Fill></p>

        <h2>9. Disclaimers and limitation of liability</h2>
        <p>
          The service is provided "as is" and "as available" without warranties of any kind to the extent
          permitted by law. To the maximum extent permitted by applicable law, <Fill>[COMPANY LEGAL NAME]</Fill>
          {' '}will not be liable for indirect, incidental, or consequential damages, or for job-application
          outcomes, arising from your use of the service.
        </p>

        <h2>10. Termination</h2>
        <p>
          You may stop using the service and request deletion of your account at any time. We may suspend
          or terminate access if you breach these Terms or misuse the service.
        </p>

        <h2>11. Governing law</h2>
        <p>
          These Terms are governed by the laws of <Fill>[JURISDICTION, e.g. India]</Fill>, and disputes are
          subject to the courts of <Fill>[CITY / STATE]</Fill>.
        </p>

        <h2>12. Contact</h2>
        <p>Questions about these Terms? Email <Fill>[CONTACT EMAIL]</Fill>.</p>
      </div>
    </div>
  );
}
