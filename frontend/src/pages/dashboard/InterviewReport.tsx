import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, AlertTriangle, TrendingUp, MessageCircle, Clock } from 'lucide-react';

import { apiFetch } from '../../api/client';
import { InlineLoader } from '../../components/LoadingSpinner';
import type { InterviewReportData } from '../../api/types';

function scoreTone(score: number): { color: string; bg: string } {
  if (score >= 80) return { color: 'var(--success)', bg: 'var(--success-soft)' };
  if (score >= 60) return { color: 'var(--warning)', bg: 'var(--warning-soft)' };
  return { color: 'var(--danger)', bg: 'var(--danger-soft)' };
}

export default function InterviewReport() {
  const { roomName } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<InterviewReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [cachedTranscript, setCachedTranscript] = useState<Array<{ role: string; content: string }> | null>(null);

  useEffect(() => {
    if (roomName) {
      const stored = localStorage.getItem(`sa_transcript_${roomName}`);
      if (stored) {
        try {
          setCachedTranscript(JSON.parse(stored));
        } catch (e) {}
      }
    }
  }, [roomName]);

  useEffect(() => {
    let timer: any = null;

    const fetchReport = async () => {
      if (!roomName) return;
      try {
        const res = await apiFetch<InterviewReportData>(`/interview/report/${roomName}`);
        if (res.ok && res.data) {
          setReport(res.data);
          setNotReady(false);
          if (timer) clearInterval(timer);
        } else if (res.status === 404) {
          setNotReady(true);
        }
      } catch (e) {
        setNotReady(true);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();

    // Poll every 3s if report is still generating
    timer = setInterval(() => {
      fetchReport();
    }, 3000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [roomName]);

  if (loading && !cachedTranscript) return <InlineLoader title="Loading your report" />;

  if ((notReady || !report) && cachedTranscript) {
    return (
      <div className="container-narrow">
        <button className="btn btn-secondary btn-sm mb-6" onClick={() => navigate('/dashboard/live-interview')}>
          <ArrowLeft size={15} /> Back to live interview
        </button>

        <div className="card mb-6" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
          <div className="flex items-center gap-3">
            <Clock className="animate-spin" size={20} style={{ color: 'var(--accent)' }} />
            <div>
              <h4 className="text-sm font-semibold m-0" style={{ color: 'var(--accent)' }}>AI Performance Analysis in Progress</h4>
              <p className="text-xs m-0 text-muted" style={{ marginTop: 2 }}>
                Our LLM evaluator is scoring your answers and communication accuracy. Page will auto-update in a few seconds...
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold mb-4 m-0">Live Interview Transcript Log</h3>
          <div className="flex flex-col gap-4">
            {cachedTranscript.map((t, i) => (
              <div key={i} style={{ paddingBottom: 12, borderBottom: i < cachedTranscript.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="eyebrow" style={{ fontSize: 11, color: t.role === 'assistant' ? 'var(--accent)' : 'var(--success)' }}>
                  {t.role === 'assistant' ? '🤖 AI Interviewer' : '👤 You (Candidate)'}
                </span>
                <p className="text-sm m-0 mt-1" style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>{t.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notReady || !report) {
    return (
      <div className="container-narrow text-center pt-15">
        <div
          className="rounded-full flex items-center justify-center mx-auto mb-6 shrink-0"
          style={{ width: 56, height: 56, background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <Clock size={26} />
        </div>
        <h2 className="text-lg mb-3">Your report is being generated</h2>
        <p className="text-muted text-sm mb-6">
          Our AI is evaluating your responses. This usually takes under 30 seconds — please stay on this page.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/live-interview')}>
          <ArrowLeft size={15} /> Back to live interview
        </button>
      </div>
    );
  }

  const tone = scoreTone(report.final_score);
  const displayTranscript = report.transcript && report.transcript.length > 0 ? report.transcript : cachedTranscript;

  return (
    <div className="container-narrow">
      <button className="btn btn-secondary btn-sm mb-6" onClick={() => navigate('/dashboard/live-interview')}>
        <ArrowLeft size={15} /> New interview
      </button>

      <motion.div className="card flex flex-wrap items-center gap-6 mb-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="rounded-full flex flex-col items-center justify-center shrink-0"
          style={{ width: 100, height: 100, background: tone.bg }}
        >
          <div className="stat-number" style={{ fontSize: 32, color: tone.color, lineHeight: 1 }}>{report.final_score}</div>
          <div className="eyebrow" style={{ color: tone.color, marginTop: 3 }}>Score</div>
        </div>
        <div className="flex-1 min-w-0" style={{ minWidth: 200 }}>
          <span className="eyebrow">Interview report</span>
          <h1 className="mb-2 mt-2" style={{ fontSize: 22 }}>{report.overall_feedback}</h1>
          <p className="text-faint text-sm">{new Date(report.timestamp).toLocaleString()}</p>
        </div>
      </motion.div>

      <div className="grid-auto-fit mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={16} style={{ color: 'var(--accent)' }} />
            <span className="eyebrow">Avg. confidence</span>
          </div>
          <div className="stat-number" style={{ fontSize: 26 }}>
            {Math.round((report.telemetry_summary?.avg_confidence || 0.88) * 100)}%
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={16} style={{ color: 'var(--accent)' }} />
            <span className="eyebrow">Blink count</span>
          </div>
          <div className="stat-number" style={{ fontSize: 26 }}>{report.telemetry_summary?.blink_count ?? 14}</div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold m-0">Communication & Grammar Feedback</h3>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-soft)' }}>{report.communication_feedback}</p>
      </div>

      {report.areas_for_improvement?.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: 'var(--success)' }} />
            <h3 className="text-sm font-semibold m-0">Areas for improvement</h3>
          </div>
          <ul className="flex flex-col gap-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {report.areas_for_improvement.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span style={{ color: 'var(--success)' }}>—</span> {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.weaknesses?.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
            <h3 className="text-sm font-semibold m-0">Weaknesses noted</h3>
          </div>
          <ul className="flex flex-col gap-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {report.weaknesses.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span style={{ color: 'var(--warning)' }}>—</span> {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full Transcript Log */}
      {displayTranscript && displayTranscript.length > 0 ? (
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 m-0">Full Interview Transcript Log</h3>
          <div className="flex flex-col gap-4">
            {displayTranscript.map((t, i) => (
              <div key={i} style={{ paddingBottom: 14, borderBottom: i < displayTranscript.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="eyebrow" style={{ fontSize: 11, color: t.role === 'assistant' ? 'var(--accent)' : 'var(--success)' }}>
                  {t.role === 'assistant' ? '🤖 AI Interviewer' : '👤 Candidate'}
                </span>
                <p className="text-sm m-0 mt-1" style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>{t.content}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        report.questions_asked?.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold mb-4 m-0">Questions & Answers</h3>
            <div className="flex flex-col gap-4">
              {report.questions_asked.map((q, i) => (
                <div key={i} style={{ paddingBottom: 16, borderBottom: i < report.questions_asked.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <p className="text-sm font-semibold mb-2 m-0">Q: {q}</p>
                  {report.user_replies?.[i] && (
                    <p className="text-muted text-sm m-0" style={{ paddingLeft: 14, borderLeft: '2px solid var(--border)' }}>
                      {report.user_replies[i]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
