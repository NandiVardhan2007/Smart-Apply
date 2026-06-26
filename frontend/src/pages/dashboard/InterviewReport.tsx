import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';
import { ArrowLeft, Brain, Eye, Star, Target, MessageSquare } from 'lucide-react';

interface ReportData {
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

export default function InterviewReport() {
  const { roomName } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let done = false;

    const fetchReport = async () => {
      if (done || !roomName) return;
      // apiFetch already prepends /api — so endpoint is /interview/report/...
      const { data, ok, status } = await apiFetch<ReportData>(`/interview/report/${roomName}`);

      if (ok) {
        done = true;
        setReport(data);
        setLoading(false);
      } else if (status === 404) {
        // Report not ready yet — just show completion message
        done = true;
        setIsProcessing(true);
        setLoading(false);
      } else {
        // Unexpected error
        done = true;
        showToast('error', 'Failed to fetch report');
        setLoading(false);
      }
    };

    // Fetch once
    fetchReport();

    return () => {
      done = true;
    };
  }, [roomName, showToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        <h2 className="text-xl font-bold">Loading...</h2>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 animate-fade-in text-center p-6">
        <div className="bg-green-500/20 p-6 rounded-full mb-4">
          <Target className="text-green-500 w-16 h-16" />
        </div>
        <h2 className="text-3xl font-bold">Interview Completed!</h2>
        <p className="text-text-secondary text-lg max-w-md">
          Great job! Your interview results are currently being processed by our AI. 
          A detailed assessment report will be mailed to you shortly.
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary mt-6">
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/dashboard/live-interview')} className="btn btn-secondary p-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold">Interview Assessment</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-bg-secondary p-6 rounded-xl border border-border flex flex-col items-center justify-center text-center">
          <Star className="text-yellow-400 mb-2" size={40} />
          <div className="text-sm text-text-secondary uppercase tracking-wider">Final Score</div>
          <div className="text-5xl font-black text-accent">{report.final_score}/100</div>
        </div>

        <div className="card bg-bg-secondary p-6 rounded-xl border border-border flex flex-col items-center justify-center text-center">
          <Brain className="text-purple-400 mb-2" size={40} />
          <div className="text-sm text-text-secondary uppercase tracking-wider">Avg Confidence</div>
          <div className="text-5xl font-black">{(report.telemetry_summary.avg_confidence * 100).toFixed(0)}%</div>
        </div>

        <div className="card bg-bg-secondary p-6 rounded-xl border border-border flex flex-col items-center justify-center text-center">
          <Eye className="text-blue-400 mb-2" size={40} />
          <div className="text-sm text-text-secondary uppercase tracking-wider">Eye Blinks</div>
          <div className="text-5xl font-black">{report.telemetry_summary.blink_count}</div>
        </div>
      </div>

      <div className="card bg-bg-secondary p-6 rounded-xl border border-border">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Target className="text-accent" /> Overall Feedback
        </h2>
        <p className="text-lg leading-relaxed">{report.overall_feedback}</p>
      </div>

      {report.communication_feedback && (
        <div className="card bg-bg-secondary p-6 rounded-xl border border-border">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="text-blue-400" /> Communication & Grammar
          </h2>
          <p className="text-lg leading-relaxed">{report.communication_feedback}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-bg-secondary p-6 rounded-xl border border-border border-l-4 border-l-green-500">
          <h3 className="text-xl font-bold mb-4">Areas for Improvement</h3>
          <ul className="list-disc pl-5 space-y-2">
            {report.areas_for_improvement.map((area, idx) => (
              <li key={idx} className="text-text-secondary">{area}</li>
            ))}
          </ul>
        </div>
        
        <div className="card bg-bg-secondary p-6 rounded-xl border border-border border-l-4 border-l-red-500">
          <h3 className="text-xl font-bold mb-4">Noted Weaknesses</h3>
          <ul className="list-disc pl-5 space-y-2">
            {report.weaknesses.map((weakness, idx) => (
              <li key={idx} className="text-text-secondary">{weakness}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card bg-bg-secondary p-6 rounded-xl border border-border">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <MessageSquare className="text-accent" /> Questions & Responses
        </h2>
        <div className="space-y-6">
          {report.questions_asked.map((q, idx) => (
            <div key={idx} className="bg-bg-primary p-4 rounded-lg">
              <div className="font-bold text-lg mb-2">Q: {q}</div>
              <div className="text-text-secondary border-l-2 border-border pl-4">
                A: {report.user_replies[idx] || "No reply recorded."}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
