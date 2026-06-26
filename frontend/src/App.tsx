import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';

// Layouts & Components
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

// Public Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OtpVerify from './pages/OtpVerify';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';

// Dashboard Pages
import Profile from './pages/dashboard/Profile';
import Resumes from './pages/dashboard/Resumes';
import ResumeTailor from './pages/dashboard/ResumeTailor';
import AtsChecker from './pages/dashboard/AtsChecker';
import AiChatbot from './pages/dashboard/AiChatbot';
import ProjectRecommender from './pages/dashboard/ProjectRecommender';
import LiveInterview from './pages/dashboard/LiveInterview';
import InterviewReport from './pages/dashboard/InterviewReport';
import Settings from './pages/dashboard/Settings';

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <Navbar />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-otp" element={<OtpVerify />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Onboarding Route */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* Protected Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard/profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="resumes" element={<Resumes />} />
              <Route path="tailor-resume/:id" element={<ResumeTailor />} />
              <Route path="ats-checker" element={<AtsChecker />} />
              <Route path="ai-chatbot" element={<AiChatbot />} />
              <Route path="project-recommender" element={<ProjectRecommender />} />
              <Route path="live-interview" element={<LiveInterview />} />
              <Route path="live-interview/report/:roomName" element={<InterviewReport />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
