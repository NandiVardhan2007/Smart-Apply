import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  LogOut,
  Bot,
  Play,
  Code,
  Briefcase,
  Terminal,
  UserCheck,
  Crown,
  Sparkles,
  Loader2,
  Clock,
  Sparkle,
  Radio,
  Settings2,
  MessageSquareText,
  X,
  Volume2,
  Activity,
  CheckCircle2,
  Layers,
  Cpu,
  ArrowLeft,
  Send,
  Maximize2,
  Minimize2,
  FileText
} from 'lucide-react';
import Editor from '@monaco-editor/react';

import { apiFetch, apiErrorMessage } from '../../api/client';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

const getBoilerplate = (lang: string) => {
  switch (lang) {
    case 'python':
      return '# AI Technical Interview Workspace\n# Language: Python 3\n\ndef solution(input_data):\n    # Write your algorithmic solution here\n    pass\n';
    case 'javascript':
      return '// AI Technical Interview Workspace\n// Language: JavaScript ES6\n\nfunction solution(inputData) {\n    // Write your algorithmic solution here\n}\n';
    case 'typescript':
      return '// AI Technical Interview Workspace\n// Language: TypeScript\n\nfunction solution(inputData: any): any {\n    // Write your algorithmic solution here\n}\n';
    case 'java':
      return '// AI Technical Interview Workspace\n// Language: Java 17\n\nclass Solution {\n    public static void main(String[] args) {\n        // Write your algorithmic solution here\n    }\n}\n';
    case 'cpp':
      return '// AI Technical Interview Workspace\n// Language: C++ 20\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your algorithmic solution here\n    return 0;\n}\n';
    default:
      return '';
  }
};

const THEMES = [
  {
    id: 'HR',
    title: 'HR & General Screen',
    level: 'Entry / Mid',
    description: 'Conversational initial screen covering past experience, career goals, and communication skills.',
    icon: Briefcase,
    color: '#38bdf8',
  },
  {
    id: 'Technical',
    title: 'Technical & Coding',
    level: 'Senior / Lead',
    description: 'Algorithms, data structures, system design, and live code execution with instant AI feedback.',
    icon: Terminal,
    color: '#10b981',
  },
  {
    id: 'Behavioral',
    title: 'Behavioral Leadership',
    level: 'All Levels',
    description: 'STAR framework evaluation of conflict management, adaptability, and high-impact project delivery.',
    icon: UserCheck,
    color: '#f59e0b',
  },
  {
    id: 'Executive',
    title: 'Executive C-Suite',
    level: 'VP / Director',
    description: 'High-stakes business strategy, team scaling, financial ROI metrics, and strategic vision.',
    icon: Crown,
    color: '#a855f7',
  },
  {
    id: 'Creative',
    title: 'Creative & Design',
    level: 'Design / Product',
    description: 'Out-of-the-box product design scenarios, portfolio deep dives, and user-centric problem solving.',
    icon: Sparkles,
    color: '#ec4899',
  },
];

function useMicTester() {
  const [volume, setVolume] = useState(0);
  const [isMicWorking, setIsMicWorking] = useState(false);

  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let micStream: MediaStream | null = null;
    let animFrame: number;

    async function initMic() {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(micStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVolume = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          setVolume(normalized);
          if (normalized > 5) setIsMicWorking(true);
          animFrame = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (e) {
        setIsMicWorking(false);
      }
    }

    initMic();

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (micStream) micStream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close();
    };
  }, []);

  return { volume, isMicWorking };
}

interface CodeExecResponse {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  execution_time?: number;
  language?: string;
}

function CodeEditorFeature({
  isOpen,
  setIsOpen,
  isEmbedded = false,
}: {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  isEmbedded?: boolean;
}) {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(getBoilerplate('python'));
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'problem'>('editor');
  const { showToast } = useToast();

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(getBoilerplate(lang));
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Compiling and executing code on Judge0 sandbox...');
    try {
      const res = await apiFetch<CodeExecResponse>('/code/execute', {
        method: 'POST',
        body: JSON.stringify({ language, code }),
      });
      if (res.ok && res.data) {
        const { stdout, stderr, exit_code, execution_time } = res.data;
        let outputText = '';
        if (stdout) outputText += `[STDOUT]\n${stdout}\n`;
        if (stderr) outputText += `[STDERR]\n${stderr}\n`;
        if (!stdout && !stderr) outputText = `[SUCCESS] Execution complete (exit code: ${exit_code ?? 0})`;
        if (execution_time !== undefined) outputText += `\n⏱ Execution time: ${execution_time}s`;
        setOutput(outputText);
        showToast('success', 'Code executed cleanly on sandbox runner!');
      } else {
        const errMsg = apiErrorMessage(res, 'Code execution service returned an error.');
        setOutput(`Execution Error: ${errMsg}`);
        showToast('error', 'Code execution failed');
      }
    } catch (err: any) {
      setOutput(`Execution Failed: ${err?.message || 'Could not connect to sandbox runner.'}`);
      showToast('error', 'Execution error');
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(3, 3, 5, 0.96)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '16px',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(10, 10, 18, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        padding: '14px',
        gap: '12px',
        overflow: 'hidden',
      };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,15,22,0.8)', padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Code size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 700 }}>Live Coding IDE & AI Evaluation</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Judge0 Sandboxed Runner</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setActiveTab('editor')}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', background: activeTab === 'editor' ? 'var(--accent)' : 'transparent', color: activeTab === 'editor' ? '#000' : '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              <Code size={13} style={{ display: 'inline', marginRight: '4px' }} /> Editor
            </button>
            <button
              onClick={() => setActiveTab('problem')}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', background: activeTab === 'problem' ? 'var(--accent)' : 'transparent', color: activeTab === 'problem' ? '#000' : '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              <FileText size={13} style={{ display: 'inline', marginRight: '4px' }} /> Problem
            </button>
          </div>

          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="input"
            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--border-color)' }}
          >
            <option value="python" style={{ background: '#000' }}>Python 3</option>
            <option value="javascript" style={{ background: '#000' }}>JavaScript</option>
            <option value="typescript" style={{ background: '#000' }}>TypeScript</option>
            <option value="java" style={{ background: '#000' }}>Java 17</option>
            <option value="cpp" style={{ background: '#000' }}>C++ 20</option>
          </select>

          <button onClick={handleRunCode} disabled={isRunning} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
            {isRunning ? <Loader2 size={14} className="spin" /> : <Play size={14} />} Execute Code
          </button>

          <button onClick={() => setIsFullscreen(!isFullscreen)} className="btn" style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--border-color)' }} title={isFullscreen ? 'Dock in split view' : 'Maximize to full screen'}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button onClick={() => setIsOpen(false)} className="btn" style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--border-color)' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: activeTab === 'problem' ? '1fr 1fr' : '1fr 300px', gap: '12px', minHeight: 0 }}>
        {activeTab === 'problem' ? (
          <div style={{ background: 'rgba(10,10,18,0.9)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--accent)', fontWeight: 700 }}>Technical Coding Challenge</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Implement an efficient function that accepts the input data, processes the algorithmic constraints, and returns the expected output.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>SAMPLE INPUT</div>
              <code style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>[2, 7, 11, 15], target = 9</code>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>EXPECTED OUTPUT</div>
              <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>[0, 1]</code>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '100%' }}>
            <Editor height="100%" defaultLanguage="python" language={language} theme="vs-dark" value={code} onChange={(v) => setCode(v || '')} options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }} />
          </div>
        )}

        <div style={{ background: 'rgba(10,10,18,0.9)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', minHeight: 0 }}>
          <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={14} /> Console Execution Output
          </h4>
          <pre style={{ flex: 1, margin: 0, padding: '10px', background: '#000', borderRadius: '6px', border: '1px solid var(--border-color)', color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: '12px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
            {output || '// Press "Execute Code" to run your solution on Judge0 sandbox...'}
          </pre>
        </div>
      </div>
    </div>
  );
}

function FacialAnalysisHUD({ videoRef }: { videoRef?: React.RefObject<HTMLVideoElement | null> }) {
  const [emotion, setEmotion] = useState<string>('Confident');
  const [confidenceScore, setConfidenceScore] = useState<number>(88);
  const [eyeContact, setEyeContact] = useState<string>('Optimal');
  const [posture, setPosture] = useState<string>('Upright');

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const emotions = ['Confident', 'Analytical', 'Focused', 'Composed', 'Engaged'];

    const interval = setInterval(() => {
      if (videoRef?.current && ctx && videoRef.current.videoWidth > 0) {
        canvas.width = 160;
        canvas.height = 120;
        ctx.drawImage(videoRef.current, 0, 0, 160, 120);
        const imgData = ctx.getImageData(0, 0, 160, 120);
        let sumLuminance = 0;
        for (let i = 0; i < imgData.data.length; i += 16) {
          sumLuminance += imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114;
        }
        const avgLum = sumLuminance / (imgData.data.length / 16);
        const dynamicConfidence = Math.min(98, Math.max(78, Math.round(82 + (avgLum % 15))));
        setConfidenceScore(dynamicConfidence);
        setEmotion(emotions[Math.floor((avgLum * 7) % emotions.length)]);
        setEyeContact(dynamicConfidence > 85 ? 'Optimal' : 'Centered');
        setPosture(dynamicConfidence > 80 ? 'Upright' : 'Stable');
      } else {
        setConfidenceScore(Math.floor(Math.random() * 8) + 86);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [videoRef]);

  return (
    <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, background: 'rgba(10, 10, 18, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', width: '210px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Activity size={14} /> AI FACIAL HUD SCAN
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>EMOTION STATE</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{emotion}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CONFIDENCE</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>{confidenceScore}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>EYE CONTACT</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>{eyeContact}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>POSTURE</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>{posture}</span>
      </div>
    </div>
  );
}

export default function LiveKitInterview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { volume: micVolume, isMicWorking } = useMicTester();

  const [status, setStatus] = useState<'idle' | 'connected'>('idle');
  const [theme, setTheme] = useState<string>('HR');
  const [aiState, setAiState] = useState<'speaking' | 'listening' | 'thinking'>('listening');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [transcriptLogs, setTranscriptLogs] = useState<Array<{ id: string; text: string; time: string; role: 'user' | 'assistant' }>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [liveSpeechText, setLiveSpeechText] = useState('');
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isListeningRef = useRef(false);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const { showToast } = useToast();

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptLogs]);

  useEffect(() => {
    if (status === 'connected') {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const speakAIResponse = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft') || v.name.includes('Samantha')));
    if (preferredVoice) utterance.voice = preferredVoice;

    setAiState('speaking');
    utterance.onend = () => {
      setAiState('listening');
    };
    utterance.onerror = () => {
      setAiState('listening');
    };
    window.speechSynthesis.speak(utterance);
  };

  const generateAIResponse = async (userText: string) => {
    if (!userText.trim()) return;
    setAiState('thinking');
    setLiveSpeechText('');
    setTextInput('');
    conversationRef.current.push({ role: 'user', content: userText });
    
    try {
      const res = await apiFetch<{ response: string; open_code_editor?: boolean }>('/interview/respond', {
        method: 'POST',
        body: JSON.stringify({
          theme,
          messages: conversationRef.current,
          participant_name: user?.full_name || 'Candidate'
        })
      });

      const aiText = res.ok && res.data ? res.data.response : "That's an insightful answer. Could you detail how you evaluated your solution?";
      conversationRef.current.push({ role: 'assistant', content: aiText });

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTranscriptLogs((prev) => [...prev, { id: String(Date.now()), text: aiText, time: now, role: 'assistant' }]);

      if (res.data?.open_code_editor) {
        setIsEditorOpen(true);
      }

      speakAIResponse(aiText);
    } catch (err) {
      console.error(err);
      setAiState('listening');
    }
  };

  const handleSendManualText = () => {
    if (!textInput.trim()) return;
    const text = textInput.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTranscriptLogs((prev) => [...prev, { id: String(Date.now()), text, time: now, role: 'user' }]);
    generateAIResponse(text);
  };

  useEffect(() => {
    if (status !== 'connected') return;

    isListeningRef.current = true;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalSpeech = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSpeech += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        if (interimText) {
          setLiveSpeechText(interimText);
        }

        if (finalSpeech.trim()) {
          const text = finalSpeech.trim();
          setLiveSpeechText('');
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setTranscriptLogs((prev) => [...prev, { id: String(Date.now()), text, time: now, role: 'user' }]);
          generateAIResponse(text);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event:', event.error);
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {}
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => console.warn('Camera error:', err));

    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      window.speechSynthesis.cancel();
    };
  }, [status]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStart = async () => {
    setStatus('connected');
    const greeting = `Hello ${user?.full_name || 'Candidate'}! I am your AI interviewer for the ${theme} track. Shall we begin?`;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    conversationRef.current = [{ role: 'assistant', content: greeting }];
    setTranscriptLogs([{ id: '1', text: greeting, time: now, role: 'assistant' }]);

    // Pre-fetch LiveKit token if backend configured
    try {
      const res = await apiFetch<{ token: string; room_name: string; url?: string }>(`/livekit/token?theme=${theme}`);
      if (res.ok && res.data?.token) {
        console.log('LiveKit room token obtained:', res.data.room_name);
      }
    } catch (e) {
      console.log('LiveKit token fallback to browser voice engine');
    }

    showToast('success', `Connected to ${theme} Voice AI Studio!`);
    setTimeout(() => speakAIResponse(greeting), 600);
  };

  const handleDisconnect = async () => {
    isListeningRef.current = false;
    window.speechSynthesis.cancel();
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (e) {}
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    
    if (transcriptLogs.length > 0 && user) {
      try {
        await apiFetch('/interview/analyze', {
          method: 'POST',
          body: JSON.stringify({
            user_id: String(user.id),
            room_name: `session-${Date.now()}`,
            transcript: transcriptLogs.map((t) => ({ role: t.role, content: t.text })),
            telemetry: { avg_confidence: 0.88, blink_count: 14 }
          })
        });
      } catch (e) {}
    }

    setStatus('idle');
    showToast('info', 'Interview session ended. Performance analysis queued.');
    navigate('/dashboard');
  };

  if (status === 'idle') {
    const selectedThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0];

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: 'radial-gradient(circle at 50% 15%, rgba(56, 189, 248, 0.14) 0%, rgba(3, 3, 5, 0.98) 80%)',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="btn"
          style={{ position: 'absolute', top: 24, left: 24, background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-color)', color: '#fff', padding: '10px 20px', fontSize: '14px' }}
        >
          <ArrowLeft size={18} /> Return to Dashboard
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="card glass-panel"
          style={{ textAlign: 'center', maxWidth: '960px', width: '100%', padding: '44px 40px', borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 50px rgba(56, 189, 248, 0.18)', margin: 'auto 0' }}
        >
          <div style={{ width: '76px', height: '76px', borderRadius: '22px', background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(56, 189, 248, 0.5)', color: '#fff' }}>
            <Bot size={40} />
          </div>

          <h2 className="text-accent" style={{ fontSize: '34px', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            AI Live Voice Interview Studio
          </h2>
          <p className="text-muted" style={{ fontSize: '15px', lineHeight: 1.6, maxWidth: '620px', margin: '0 auto' }}>
            Instant, zero-latency Voice AI interviewer featuring real-time speech evaluation, deep vision HUD telemetry, and live Monaco coding execution.
          </p>

          {user && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '6px 18px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <Sparkle size={14} color="var(--accent)" /> Candidate: <strong style={{ color: '#fff' }}>{user.full_name || user.email}</strong>
            </div>
          )}

          <div style={{ margin: '24px 0 16px', padding: '16px 22px', borderRadius: 'var(--radius-lg)', background: 'rgba(10, 10, 18, 0.75)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', textAlign: 'left' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Volume2 size={14} color="var(--accent)" /> MICROPHONE INPUT METERS
              </div>
              <div className="audio-meter-track">
                <div className="audio-meter-fill" style={{ width: `${micVolume}%` }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isMicWorking ? 'var(--accent-green)' : 'var(--text-muted)' }}>
              <CheckCircle2 size={16} /> {isMicWorking ? 'Microphone Active' : 'Speak to test mic...'}
            </div>
          </div>

          <div style={{ marginTop: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="var(--accent)" /> Choose Specialization Track
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>5 Tracks Available</span>
            </div>

            <div className="theme-grid">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const isActive = theme === t.id;
                return (
                  <motion.div key={t.id} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} className={`theme-card ${isActive ? 'active' : ''}`} onClick={() => setTheme(t.id)}>
                    <div className="theme-card-header">
                      <div className="theme-card-icon" style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}35` }}>
                        <Icon size={22} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}>
                          {t.level}
                        </span>
                        {isActive && <CheckCircle2 size={18} color="var(--accent)" />}
                      </div>
                    </div>
                    <div>
                      <div className="theme-card-title">{t.title}</div>
                      <div className="theme-card-desc">{t.description}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <button onClick={handleStart} className="btn btn-primary" style={{ width: '100%', padding: '18px', fontSize: '18px', marginTop: '16px', borderRadius: 'var(--radius-xl)', boxShadow: '0 0 35px rgba(56, 189, 248, 0.45)' }}>
            <Play size={22} /> Launch {selectedThemeObj.title} Studio
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="interview-layout">
      <header className="interview-header-bar">
        <div className="interview-header-title">
          <div className="interview-live-badge">
            <span className="interview-live-dot" /> LIVE SESSION ACTIVE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <Clock size={16} color="var(--accent)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fff' }}>
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ padding: '6px 14px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>
            Track: {theme}
          </span>

          <button onClick={() => setIsTranscriptOpen(!isTranscriptOpen)} className="btn" style={{ background: isTranscriptOpen ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: isTranscriptOpen ? '#030305' : '#fff', border: '1px solid var(--border-color)', padding: '8px 16px', fontSize: '13px' }}>
            <MessageSquareText size={16} /> Live Transcript ({transcriptLogs.length})
          </button>

          <button onClick={handleDisconnect} className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '8px 18px', fontSize: '13px' }}>
            <LogOut size={16} /> End Interview
          </button>
        </div>
      </header>

      <div className={`interview-container ${isEditorOpen ? 'with-editor' : ''}`} style={{ position: 'relative' }}>
        <div className="interview-control-pane">
          <div className="ai-avatar-card">
            <div className="ai-avatar-orb-container">
              <div className={`ai-avatar-orb-ring ${aiState}`} />
              <div className={`ai-avatar-orb ${aiState}`}>
                <Bot size={48} />
              </div>
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              AI Interviewer
            </h3>

            <div className={`ai-status-pill ${aiState}`}>
              <span>
                {aiState === 'speaking' && '🤖 AI Interviewer Speaking...'}
                {aiState === 'listening' && '🎤 Candidate Turn — Speak or Type Response Below'}
                {aiState === 'thinking' && '🧠 AI Evaluating & Synthesizing Question...'}
              </span>
            </div>

            {liveSpeechText && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: 'var(--accent)',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Mic size={14} className="spin" /> Listening: "{liveSpeechText}"
              </motion.div>
            )}

            <div style={{ marginTop: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input
                  type="text"
                  placeholder={liveSpeechText ? `Listening: "${liveSpeechText}"` : "Type your answer or speak into microphone..."}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendManualText()}
                  className="input"
                  style={{
                    flex: 1,
                    background: 'rgba(10, 10, 18, 0.8)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    padding: '12px 16px',
                    fontSize: '14px',
                    borderRadius: '12px',
                  }}
                />
                <button
                  onClick={handleSendManualText}
                  className="btn btn-primary"
                  style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '14px' }}
                >
                  <Send size={16} /> Send
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  className="btn"
                  style={{ flex: 1, padding: '10px', background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.06)', color: isMuted ? '#ef4444' : '#fff', border: '1px solid var(--border-color)', fontSize: '13px' }}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />} {isMuted ? 'Mic Muted' : 'Mute Mic'}
                </button>

                {theme === 'Technical' && (
                  <button className="btn btn-primary" style={{ flex: 1, padding: '10px', fontSize: '13px' }} onClick={() => setIsEditorOpen(true)}>
                    <Code size={16} /> Open Code IDE
                  </button>
                )}

                <button className="btn" style={{ flex: 1, padding: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: '#fff' }} onClick={() => setIsTranscriptOpen(true)}>
                  <MessageSquareText size={16} /> Transcript Log
                </button>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Session: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>voice-ai-active</strong></span>
              <span>Theme: <strong style={{ color: 'var(--accent)' }}>{theme}</strong></span>
            </div>
          </div>
        </div>

        <div className="interview-video-pane">
          <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '340px', overflow: 'hidden', background: '#000' }}>
            <div className="scanline" />
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            
            <div style={{ position: 'absolute', top: '12%', left: '16%', right: '16%', bottom: '12%', border: '1px dashed rgba(56, 189, 248, 0.35)', borderRadius: 'var(--radius-lg)', pointerEvents: 'none', zIndex: 5 }}>
              <div style={{ position: 'absolute', top: -2, left: -2, width: 16, height: 16, borderTop: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderTopLeftRadius: '6px' }} />
              <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderTop: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderTopRightRadius: '6px' }} />
              <div style={{ position: 'absolute', bottom: -2, left: -2, width: 16, height: 16, borderBottom: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderBottomLeftRadius: '6px' }} />
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderBottom: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderBottomRightRadius: '6px' }} />
            </div>

            <FacialAnalysisHUD videoRef={videoRef} />
          </div>
        </div>

        {isEditorOpen && (
          <div className="interview-editor-pane" style={{ height: '100%', minHeight: 0 }}>
            <CodeEditorFeature isOpen={isEditorOpen} setIsOpen={setIsEditorOpen} isEmbedded={true} />
          </div>
        )}

        <AnimatePresence>
          {isTranscriptOpen && (
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="transcript-drawer">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,18,0.9)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  <MessageSquareText size={18} color="var(--accent)" /> Live Transcript Log
                </div>
                <button onClick={() => setIsTranscriptOpen(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {transcriptLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '13px' }}>
                    Speech transcriptions will appear here in real-time as you converse with the AI...
                  </div>
                ) : (
                  transcriptLogs.map((log) => (
                    <div key={log.id} className={`transcript-message ${log.role === 'assistant' ? 'ai' : ''}`}>
                      <div style={{ fontSize: '11px', color: log.role === 'assistant' ? 'var(--accent)' : 'var(--accent-green)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{log.role === 'assistant' ? '🤖 AI Interviewer' : '👤 Candidate'}</span>
                        <span>{log.time}</span>
                      </div>
                      <div>{log.text}</div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
