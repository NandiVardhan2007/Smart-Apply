import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import { InlineLoader } from './components/LoadingSpinner';

// Route-level code splitting: each page (and its dependencies — Monaco,
// face-api, etc.) loads only when the person actually navigates there,
// keeping the initial bundle small.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const OtpVerify = lazy(() => import('./pages/OtpVerify'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Home = lazy(() => import('./pages/dashboard/Home'));
const Resumes = lazy(() => import('./pages/dashboard/Resumes'));
const CoverLetterGenerator = lazy(() => import('./pages/dashboard/CoverLetterGenerator'));
const JobMatching = lazy(() => import('./pages/dashboard/JobMatching'));
const ResumeTailor = lazy(() => import('./pages/dashboard/ResumeTailor'));
const AtsChecker = lazy(() => import('./pages/dashboard/AtsChecker'));
const AiChatbot = lazy(() => import('./pages/dashboard/AiChatbot'));
const ProjectRecommender = lazy(() => import('./pages/dashboard/ProjectRecommender'));
const LiveInterview = lazy(() => import('./pages/dashboard/LiveInterview'));
const InterviewReport = lazy(() => import('./pages/dashboard/InterviewReport'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));

function PageFallback() {
  return <InlineLoader title="Loading…" />;
}

/**
 * Fades and lifts each dashboard page in on navigation, keyed by pathname.
 * This lives *inside* DashboardLayout (below the Suspense boundary) so only
 * the page content transitions — the sidebar never re-animates or flickers
 * when moving between dashboard routes. Kept to a single quick enter
 * animation (no exit) so it never fights with Suspense while a lazy chunk
 * is still loading.
 */
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Suspense fallback={<PageFallback />}>
          <PageTransition>{children}</PageTransition>
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<OtpVerify />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Onboarding sits outside the dashboard shell, but still requires auth */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        {/* Dashboard */}
        <Route path="/dashboard" element={<Protected><Home /></Protected>} />
        <Route path="/dashboard/resumes" element={<Protected><Resumes /></Protected>} />
        <Route path="/dashboard/cover-letter" element={<Protected><CoverLetterGenerator /></Protected>} />
        <Route path="/dashboard/jobs" element={<Protected><JobMatching /></Protected>} />
        <Route path="/dashboard/tailor-resume/:id" element={<Protected><ResumeTailor /></Protected>} />
        <Route path="/dashboard/ats-checker" element={<Protected><AtsChecker /></Protected>} />
        <Route path="/dashboard/ai-chatbot" element={<Protected><AiChatbot /></Protected>} />
        <Route path="/dashboard/project-recommender" element={<Protected><ProjectRecommender /></Protected>} />
        <Route path="/dashboard/live-interview" element={<Protected><LiveInterview /></Protected>} />
        <Route path="/dashboard/live-interview/report/:roomName" element={<Protected><InterviewReport /></Protected>} />
        <Route path="/dashboard/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/dashboard/settings" element={<Protected><Settings /></Protected>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
