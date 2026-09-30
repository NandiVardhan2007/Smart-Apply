import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../../styles/legal.css';

const UPDATED = 'September 2026';

function Fill({ children }: { children: string }) {
  return <span className="legal-fill">{children}</span>;
}

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back"><ArrowLeft size={15} /> Back to home</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {UPDATED}</p>

        <p>
          This Privacy Policy explains how <Fill>[COMPANY LEGAL NAME]</Fill> ("Smart Apply", "we",
          "us") collects, uses, shares, and protects your personal data when you use our
          website and services. We are committed to processing your data lawfully and
          transparently, in line with India's Digital Personal Data Protection Act, 2023 (DPDP Act).
        </p>

        <h2>1. Who we are</h2>
        <p>
          The data fiduciary responsible for your personal data is <Fill>[COMPANY LEGAL NAME]</Fill>,
          located at <Fill>[REGISTERED ADDRESS]</Fill>. For any privacy questions or to exercise your
          rights, contact us at <Fill>[CONTACT EMAIL]</Fill>.
        </p>

        <h2>2. Data we collect</h2>
        <ul>
          <li><strong>Account data:</strong> your name, email address, and a securely hashed password.</li>
          <li><strong>Profile data you provide:</strong> bio, skills, education, work experience, and links (LinkedIn, GitHub, portfolio).</li>
          <li><strong>Documents:</strong> resumes and related files you upload or generate, and text extracted from them.</li>
          <li><strong>Generated content:</strong> tailored resumes, cover letters, chat messages, and interview transcripts you create using our AI tools.</li>
          <li><strong>Interview practice telemetry:</strong> when you use Live Interview, facial cues (e.g. blink rate, an aggregate "confidence" score) are computed <strong>in your browser</strong>. Only summary scores and the text transcript are stored for your report. <Fill>[CONFIRM: video/audio streams are not uploaded or retained]</Fill>.</li>
          <li><strong>Technical data:</strong> IP address, device/browser information, and basic usage logs needed to operate and secure the service.</li>
        </ul>

        <h2>3. How we use your data</h2>
        <ul>
          <li>To create and manage your account and authenticate you.</li>
          <li>To provide the features you request (resume tailoring, ATS scoring, job matching, cover letters, AI chat, interview practice).</li>
          <li>To send transactional emails such as one-time passcodes and results you ask us to email.</li>
          <li>To secure the service, prevent abuse, and comply with legal obligations.</li>
        </ul>
        <p>We collect only the data necessary for these purposes and do not sell your personal data.</p>

        <h2>4. Legal basis and consent</h2>
        <p>
          Under the DPDP Act, we process your personal data based on the consent you provide when you
          sign up and use specific features, and for certain legitimate uses permitted by law. You may
          withdraw consent at any time (see "Your rights"); withdrawal does not affect processing already
          carried out.
        </p>

        <h2>5. Third-party services (data processors)</h2>
        <p>We share limited data with the following providers strictly to deliver the service:</p>
        <ul>
          <li><strong>NVIDIA (AI inference):</strong> resume/profile/interview text is sent to generate AI outputs.</li>
          <li><strong>Brevo (email):</strong> your email address to deliver OTPs and requested results.</li>
          <li><strong>Judge0 (code execution):</strong> code you submit in coding features.</li>
          <li><strong>Cloudflare R2 (storage):</strong> files you upload.</li>
          <li><strong>JSearch / RapidAPI (job search):</strong> your search query (not your identity).</li>
          <li><strong>MongoDB Atlas & Render (hosting/database):</strong> stores and runs the application.</li>
          <li><strong>Google Fonts:</strong> loading web fonts may share your IP address with Google. <Fill>[We plan to self-host fonts to avoid this]</Fill>.</li>
        </ul>

        <h2>6. Data retention</h2>
        <p>
          We keep your personal data only as long as your account is active or as needed to provide the
          service, then delete or anonymize it within <Fill>[RETENTION PERIOD, e.g. 90 days]</Fill> of account
          deletion, unless a longer period is required by law.
        </p>

        <h2>7. Your rights</h2>
        <p>Subject to the DPDP Act, you have the right to:</p>
        <ul>
          <li>Access a summary of the personal data we process about you.</li>
          <li>Request correction, completion, or updating of your data.</li>
          <li>Request erasure of your data.</li>
          <li>Withdraw consent and nominate another person to exercise your rights in the event of death or incapacity.</li>
          <li>Raise a grievance with us and, if unresolved, with the Data Protection Board of India.</li>
        </ul>
        <p>To exercise any right, email <Fill>[CONTACT EMAIL]</Fill>.</p>

        <h2>8. Grievance / Data Protection Officer</h2>
        <p>
          Our Grievance Officer is <Fill>[OFFICER NAME]</Fill>, reachable at <Fill>[GRIEVANCE EMAIL]</Fill>.
          We will acknowledge and respond to grievances within the timelines required by the DPDP Act.
        </p>

        <h2>9. Security</h2>
        <p>
          We protect your data with encryption in transit (HTTPS), hashed passwords, access controls,
          and time-limited sessions. No method of transmission or storage is perfectly secure, but we
          work to safeguard your information and will notify you and the Board of a breach as required.
        </p>

        <h2>10. Children's data</h2>
        <p>
          Smart Apply is intended for users aged 18 and above. We do not knowingly process the personal
          data of children without verifiable parental consent, and we do not undertake tracking,
          behavioural monitoring, or targeted advertising directed at children.
        </p>

        <h2>11. Changes to this policy</h2>
        <p>We may update this policy; we will post the new version here and update the "Last updated" date.</p>

        <h2>12. Contact</h2>
        <p>Questions? Email <Fill>[CONTACT EMAIL]</Fill>. See also our <Link to="/terms">Terms & Conditions</Link> and <Link to="/cookies-policy">Cookie Policy</Link>.</p>
      </div>
    </div>
  );
}
