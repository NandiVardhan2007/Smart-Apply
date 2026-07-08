/**
 * Shared types mirroring the backend's Pydantic schemas
 * (see backend/app/schemas and backend/app/models).
 */

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  is_admin?: boolean;
  profile_pic_url?: string | null;
  bio?: string | null;
  skills?: string[];
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  education?: string[];
  experience?: string[];
  has_onboarded?: boolean;
}

export interface Resume {
  _id: string;
  filename: string;
  file_url: string;
  file_key?: string;
  extracted_text?: string;
  latex_code?: string;
  html_code?: string;
  is_primary: boolean;
  ats_score?: number | null;
  uploaded_at: string;
}

export interface DashboardStats {
  total_resumes: number;
  total_interviews: number;
  avg_ats_score: number;
  member_since: string | null;
}

export interface AtsCheckResult {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
}

export interface ResumeParseResult {
  full_name?: string | null;
  bio?: string | null;
  skills: string[];
  education: string[];
  experience: string[];
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  rating: number;
  skill_level: string;
  estimated_time: string;
  key_technologies: string[];
}

export interface RoadmapPhase {
  phase_number: number;
  title: string;
  description: string;
  tasks: string[];
}

export interface InterviewReportData {
  user_id: string;
  room_name: string;
  timestamp: string;
  questions_asked: string[];
  user_replies: string[];
  areas_for_improvement: string[];
  weaknesses: string[];
  telemetry_summary: {
    avg_confidence: number;
    blink_count: number;
  };
  final_score: number;
  overall_feedback: string;
  communication_feedback: string;
}

/** Generic shape for backend error responses: `{ "detail": "..." }` */
export interface ApiError {
  detail?: string;
}
