import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useMediaDeviceSelect,
  useLocalParticipant,
  useRoomContext,
  VideoTrack,
  BarVisualizer,
  useVoiceAssistant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { RoomEvent, Track } from 'livekit-client';
import type { TranscriptionSegment, Participant, TrackPublication } from 'livekit-client';
import * as faceapi from '@vladmandic/face-api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
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
  ArrowLeft
} from 'lucide-react';
import Editor from '@monaco-editor/react';

import { apiFetch } from '../../api/client';
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
      return '// AI Technical Interview Workspace\n// Language: C++ 20\n\n#include <iostream>\n\nint main() {\n    // Write your algorithmic solution here\n    return 0;\n}\n';
    default:
      return '';
  }
};

const THEMES = [
  {
    id: 'HR',
    title: 'HR & General Screen',
    icon: Briefcase,
    color: '#38bdf8',
    level: 'Entry / Mid',
    description: 'Conversational initial screen covering past experience, career goals, and communication skills.',
  },
  {
    id: 'Technical',
    title: 'Technical & Coding',
    icon: Terminal,
    color: '#34d399',
    level: 'Senior / Lead',
    description: 'Algorithms, data structures, system design, and live code execution with instant AI feedback.',
  },
  {
    id: 'Behavioral',
    title: 'Behavioral Leadership',
    icon: UserCheck,
    color: '#fbbf24',
    level: 'All Levels',
    description: 'STAR framework evaluation of conflict management, adaptability, and high-impact project delivery.',
  },
  {
    id: 'Executive',
    title: 'Executive C-Suite',
    icon: Crown,
    color: '#a855f7',
    level: 'VP / Director',
    description: 'High-stakes business strategy, team scaling, financial ROI metrics, and strategic vision.',
  },
  {
    id: 'Creative',
    title: 'Creative & Design',
    icon: Sparkles,
    color: '#f472b6',
    level: 'Design / Product',
    description: 'Out-of-the-box product design scenarios, portfolio deep dives, and user-centric problem solving.',
  },
];

// Pre-Flight Live Mic Tester Hook
function useMicTester() {
  const [volume, setVolume] = useState(0);
  const [isMicWorking, setIsMicWorking] = useState(false);

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let microphone: MediaStreamAudioSourceNode | null = null;
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startMic = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          analyser?.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((average / 128) * 100));
          setVolume(normalized);
          if (normalized > 5) setIsMicWorking(true);
          animationFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        console.warn('Mic tester unauthorized or unavailable:', err);
      }
    };

    startMic();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (microphone) microphone.disconnect();
      if (analyser) analyser.disconnect();
      if (audioContext) audioContext.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { volume, isMicWorking };
}

function CodeEditorFeature({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const { showToast } = useToast();
  const room = useRoomContext();
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(getBoilerplate('python'));
  const [questionData, setQuestionData] = useState<{
    title?: string;
    description?: string;
    sample_input?: string;
    sample_output?: string;
  } | null>(null);

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array, _participant: any, _kind: any, topic?: string) => {
      if (topic === 'open_code_editor') {
        try {
          const text = new TextDecoder().decode(payload);
          if (text !== 'open') {
            const data = JSON.parse(text);
            setQuestionData(data);
          } else {
            setQuestionData(null);
          }
        } catch {
          setQuestionData(null);
        }
        setIsOpen(true);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, setIsOpen]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setCode(getBoilerplate(newLang));
  };

  const handleSubmit = () => {
    if (localParticipant) {
      const payloadObj = { code, language };
      const payload = new TextEncoder().encode(JSON.stringify(payloadObj));
      localParticipant.publishData(payload, { topic: 'code_submission' });
      showToast('success', 'Code solution transmitted to AI Interviewer!');
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" style={{ zIndex: 100 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="modal modal-large glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '90vh',
            width: '94vw',
            maxWidth: '1350px',
            padding: 0,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 50px rgba(56, 189, 248, 0.25)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '16px 24px',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(8, 8, 14, 0.98)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <Code size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  AI Technical Coding IDE <span className="cyber-badge">REALTIME EVAL</span>
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Write clean algorithms — evaluated by AI for correctness, efficiency & time complexity.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <select
                value={language}
                onChange={handleLanguageChange}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
              >
                <option value="python" style={{ color: '#000' }}>Python 3</option>
                <option value="javascript" style={{ color: '#000' }}>JavaScript (ES6)</option>
                <option value="typescript" style={{ color: '#000' }}>TypeScript</option>
                <option value="java" style={{ color: '#000' }}>Java 17</option>
                <option value="cpp" style={{ color: '#000' }}>C++ 20</option>
              </select>

              <button
                onClick={() => setIsOpen(false)}
                className="btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                }}
              >
                <X size={16} /> Minimize Editor
              </button>
            </div>
          </div>

          {/* Content Pane */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Question Details */}
            {questionData && (
              <div
                style={{
                  flex: 1,
                  padding: '24px',
                  borderRight: '1px solid var(--border-color)',
                  overflowY: 'auto',
                  background: 'rgba(5, 5, 10, 0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} color="var(--accent)" />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    QUESTION PROMPT
                  </span>
                </div>
                <h2 style={{ margin: 0, color: 'var(--accent)', fontSize: '22px' }}>
                  {questionData.title || 'Algorithmic Challenge'}
                </h2>
                <p
                  style={{
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.65,
                    fontSize: '14px',
                  }}
                >
                  {questionData.description}
                </p>

                {questionData.sample_input && (
                  <div>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                      SAMPLE INPUT
                    </h4>
                    <pre
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        padding: '14px',
                        borderRadius: '10px',
                        color: 'var(--accent-green)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        border: '1px solid var(--border-color)',
                        overflowX: 'auto',
                      }}
                    >
                      {questionData.sample_input}
                    </pre>
                  </div>
                )}

                {questionData.sample_output && (
                  <div>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                      SAMPLE OUTPUT
                    </h4>
                    <pre
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        padding: '14px',
                        borderRadius: '10px',
                        color: 'var(--accent-pink)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        border: '1px solid var(--border-color)',
                        overflowX: 'auto',
                      }}
                    >
                      {questionData.sample_output}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Monaco Code Editor */}
            <div style={{ flex: questionData ? 1.5 : 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineHeight: 22,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: { other: true, comments: true, strings: true },
                  wordBasedSuggestions: 'currentDocument',
                  acceptSuggestionOnEnter: 'on',
                  padding: { top: 16, bottom: 16 },
                  bracketPairColorization: { enabled: true },
                }}
              />
            </div>
          </div>

          {/* Footer Bar */}
          <div
            style={{
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(8, 8, 14, 0.98)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <Activity size={16} color="var(--accent-green)" />
              <span>Language: <strong style={{ color: '#fff' }}>{language.toUpperCase()}</strong></span>
            </div>

            <button className="btn btn-primary" onClick={handleSubmit} style={{ padding: '12px 32px' }}>
              <Terminal size={18} /> Submit Solution to AI
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function CustomDeviceSelect({ kind }: { kind: 'videoinput' | 'audioinput' }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });

  return (
    <select
      value={activeDeviceId}
      onChange={(e) => setActiveMediaDevice(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-color)',
        background: 'rgba(255, 255, 255, 0.04)',
        color: 'var(--text-primary)',
        fontSize: '13px',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage:
          'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2338bdf8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 14px top 50%',
        backgroundSize: '10px auto',
      }}
    >
      {devices.map((device) => (
        <option key={device.deviceId} value={device.deviceId} style={{ color: '#000000', background: '#ffffff' }}>
          {device.label || `Device ${device.deviceId}`}
        </option>
      ))}
    </select>
  );
}

function LiveSubtitles({
  onNewSegment,
}: {
  onNewSegment?: (seg: TranscriptionSegment) => void;
}) {
  const room = useRoomContext();
  const [segments, setSegments] = useState<Record<string, TranscriptionSegment>>({});

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (
      incomingSegments: TranscriptionSegment[],
      _participant?: Participant,
      _publication?: TrackPublication
    ) => {
      setSegments((prev) => {
        const next = { ...prev };
        for (const segment of incomingSegments) {
          next[segment.id] = segment;
          if (onNewSegment) onNewSegment(segment);
        }
        return next;
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room, onNewSegment]);

  const activeSegments = Object.values(segments)
    .sort((a, b) => a.firstReceivedTime - b.firstReceivedTime)
    .slice(-1);

  if (activeSegments.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '85%',
        textAlign: 'center',
        zIndex: 20,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {activeSegments.map((seg) => (
        <motion.div
          key={seg.id}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          style={{
            background: 'rgba(10, 10, 18, 0.92)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '16px',
            fontSize: '15px',
            fontWeight: 500,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(56, 189, 248, 0.3)',
            maxWidth: '100%',
            wordWrap: 'break-word',
            lineHeight: '1.5',
          }}
        >
          {seg.text}
        </motion.div>
      ))}
    </div>
  );
}

function FacialAnalysisHUD() {
  const [focus, setFocus] = useState(0);
  const [expression, setExpression] = useState('Initializing ML...');
  const [posture, setPosture] = useState('Tracking...');

  useEffect(() => {
    let active = true;
    let interval: any;

    const startVision = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
        ]);

        if (!active) return;
        setExpression('Detecting Face...');

        interval = setInterval(async () => {
          const video = document.querySelector('video');
          if (!video || video.paused || video.ended || video.readyState < 2) return;

          try {
            const detections = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
              .withFaceExpressions();

            if (detections) {
              setFocus(detections.detection.score * 100);

              const sorted = Object.entries(detections.expressions).sort((a, b) => b[1] - a[1]);
              if (sorted.length > 0) {
                let topExpr = sorted[0][0];
                topExpr = topExpr.charAt(0).toUpperCase() + topExpr.slice(1);
                setExpression(topExpr);
              }
              setPosture('Upright / Focused');
            } else {
              setFocus(0);
              setExpression('Searching...');
              setPosture('Unknown');
            }
          } catch (err) {
            console.error('Face detection error:', err);
          }
        }, 400);
      } catch (err) {
        console.error('Failed to load FaceAPI models', err);
      }
    };

    startVision();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        padding: '14px 18px',
        borderRadius: 'var(--radius)',
        color: 'var(--accent)',
        fontFamily: 'var(--font-mono)',
        width: '215px',
        zIndex: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 700,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '6px',
          marginBottom: '10px',
          color: 'var(--text-secondary)',
          letterSpacing: '0.05em',
        }}
      >
        <Radio size={12} color="#34d399" className="spin" /> ML EYE & FACE HUD
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>FOCUS / EYE CONTACT</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{focus.toFixed(0)}%</div>
          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${focus}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8, #34d399)',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>EXPRESSION</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>{expression}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>POSTURE</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>{posture}</span>
      </div>
    </div>
  );
}

function VideoView({ onNewSegment }: { onNewSegment?: (seg: TranscriptionSegment) => void }) {
  const { localParticipant, cameraTrack } = useLocalParticipant();

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {/* Laser Scanline Beam */}
      <div className="scanline" />

      {localParticipant && cameraTrack?.track ? (
        <VideoTrack
          trackRef={{ participant: localParticipant, source: Track.Source.Camera, publication: cameraTrack }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            gap: '12px',
          }}
        >
          <Loader2 size={36} className="spin" color="var(--accent)" />
          <span style={{ fontSize: '14px' }}>Initializing HD Candidate Video Stream...</span>
        </div>
      )}

      {/* Cybernetic Target Frame */}
      <div
        style={{
          position: 'absolute',
          top: '16%',
          left: '22%',
          right: '22%',
          bottom: '16%',
          border: '1px dashed rgba(56, 189, 248, 0.35)',
          borderRadius: 'var(--radius-lg)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <div style={{ position: 'absolute', top: -2, left: -2, width: 18, height: 18, borderTop: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderTopLeftRadius: '6px' }} />
        <div style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderTop: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderTopRightRadius: '6px' }} />
        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 18, height: 18, borderBottom: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderBottomLeftRadius: '6px' }} />
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderBottom: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderBottomRightRadius: '6px' }} />
      </div>

      <FacialAnalysisHUD />
      <LiveSubtitles onNewSegment={onNewSegment} />
    </div>
  );
}

function AIAvatarPanel({
  roomName,
  theme,
  setIsEditorOpen,
  setIsTranscriptOpen,
}: {
  roomName: string;
  theme: string;
  setIsEditorOpen: (val: boolean) => void;
  setIsTranscriptOpen: (val: boolean) => void;
}) {
  const { state } = useVoiceAssistant();
  const room = useRoomContext();

  useEffect(() => {
    if (room) {
      room.startAudio().catch((err) => console.warn('Audio start prevented by autoplay:', err));
    }
  }, [room]);

  const handleUnmuteAudio = () => {
    if (room) room.startAudio().catch(() => {});
  };

  const getStatusText = () => {
    switch (state) {
      case 'speaking':
        return '🤖 AI Interviewer Speaking...';
      case 'listening':
        return '🎤 Listening to candidate...';
      case 'thinking':
        return '🧠 AI Processing response...';
      case 'connecting':
      case 'initializing':
        return '⏳ Connecting AI interviewer...';
      default:
        return '✨ AI Connected & Ready';
    }
  };

  return (
    <div className="ai-avatar-card" onClick={handleUnmuteAudio}>
      <div className="ai-avatar-orb-container">
        <div className={`ai-avatar-orb-ring ${state}`} />
        <div className={`ai-avatar-orb ${state}`}>
          <Bot size={48} />
        </div>
      </div>

      <h3 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
        AI Interviewer
      </h3>

      <div className={`ai-status-pill ${state}`}>
        <span>{getStatusText()}</span>
      </div>

      {/* Bar Visualizer */}
      <div style={{ width: '100%', height: '40px', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BarVisualizer state={state} barCount={9} style={{ height: '36px', width: '160px' }} />
      </div>

      {/* Voice Controls */}
      <div style={{ marginTop: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <VoiceAssistantControlBar />

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          {theme === 'Technical' && (
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '12px', fontSize: '13px' }}
              onClick={() => setIsEditorOpen(true)}
            >
              <Code size={16} /> Open Code IDE
            </button>
          )}
          <button
            className="btn"
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '13px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              color: '#fff',
            }}
            onClick={() => setIsTranscriptOpen(true)}
          >
            <MessageSquareText size={16} /> Live Transcript Log
          </button>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <span>Session ID: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{roomName.slice(0, 14)}...</strong></span>
        <span>Theme: <strong style={{ color: 'var(--accent)' }}>{theme}</strong></span>
      </div>
    </div>
  );
}

// Main Interactive Page Component
export default function LiveKitInterview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { volume: micVolume, isMicWorking } = useMicTester();
  const [token, setToken] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [theme, setTheme] = useState<string>('HR');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [transcriptLogs, setTranscriptLogs] = useState<Array<{ id: string; text: string; time: string }>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const { showToast } = useToast();
  const timerRef = useRef<any>(null);

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

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStart = async () => {
    setStatus('connecting');
    try {
      const res = await apiFetch<{ token: string; room_name: string }>(`/livekit/token?theme=${theme}`);
      if (!res.ok) throw new Error('Failed to fetch LiveKit token');
      const data = res.data;
      setToken(data.token);
      setRoomName(data.room_name);
      setStatus('connected');
      showToast('success', `Connected to ${theme} AI Interview Studio!`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Could not connect to LiveKit room. Check server credentials.');
      setStatus('idle');
    }
  };

  const handleDisconnect = () => {
    setToken('');
    setStatus('idle');
    showToast('info', 'Interview session completed.');
  };

  const handleExitStudio = () => {
    handleDisconnect();
    navigate('/dashboard');
  };

  const handleNewSegment = (seg: TranscriptionSegment) => {
    setTranscriptLogs((prev) => {
      if (prev.some((item) => item.id === seg.id)) return prev;
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return [...prev, { id: seg.id, text: seg.text, time: now }];
    });
  };

  // Lobby / Pre-Flight Setup Screen
  if (status === 'idle' || status === 'connecting') {
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
        {/* Top Left Exit Button */}
        <button
          onClick={handleExitStudio}
          className="btn"
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-color)',
            color: '#fff',
            padding: '10px 20px',
            fontSize: '14px',
          }}
        >
          <ArrowLeft size={18} /> Return to Dashboard
        </button>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="card glass-panel"
          style={{
            textAlign: 'center',
            maxWidth: '960px',
            width: '100%',
            padding: '44px 40px',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 50px rgba(56, 189, 248, 0.18)',
            margin: 'auto 0',
          }}
        >
          {/* Header Icon */}
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 40px rgba(56, 189, 248, 0.5)',
              color: '#fff',
            }}
          >
            <Bot size={40} />
          </div>

          <h2 className="text-accent" style={{ fontSize: '34px', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            AI Live Interview Studio Setup
          </h2>
          <p className="text-muted" style={{ fontSize: '15px', lineHeight: 1.6, maxWidth: '620px', margin: '0 auto' }}>
            Select your target role track below to customize the AI interviewer's persona, interview depth, and live evaluation algorithms.
          </p>

          {/* Candidate Info Badge */}
          {user && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '16px',
                padding: '6px 18px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              <Sparkle size={14} color="var(--accent)" /> Authenticated Candidate:{' '}
              <strong style={{ color: '#fff' }}>{user.full_name || user.email}</strong>
            </div>
          )}

          {/* Pre-Flight System Check Bar */}
          <div
            style={{
              margin: '24px 0 16px',
              padding: '16px 22px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(10, 10, 18, 0.75)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              textAlign: 'left',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Volume2 size={14} color="var(--accent)" /> HARDWARE CHECK • MICROPHONE INPUT METERS
              </div>
              <div className="audio-meter-track">
                <div className="audio-meter-fill" style={{ width: `${micVolume}%` }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isMicWorking ? 'var(--accent-green)' : 'var(--text-muted)' }}>
              <CheckCircle2 size={16} /> {isMicWorking ? 'Microphone Active' : 'Speak to test mic...'}
            </div>
          </div>

          {/* Theme Selector */}
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
                  <motion.div
                    key={t.id}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    className={`theme-card ${isActive ? 'active' : ''}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <div className="theme-card-header">
                      <div className="theme-card-icon" style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}35` }}>
                        <Icon size={22} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            background: `${t.color}15`,
                            color: t.color,
                            border: `1px solid ${t.color}30`,
                          }}
                        >
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

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={status === 'connecting'}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '18px',
              marginTop: '16px',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 0 35px rgba(56, 189, 248, 0.45)',
            }}
          >
            {status === 'connecting' ? (
              <>
                <Loader2 size={22} className="spin" /> Initializing {selectedThemeObj.title} Session...
              </>
            ) : (
              <>
                <Play size={22} /> Launch {selectedThemeObj.title} Studio
              </>
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  // Active Studio Room View
  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      connect={true}
      onDisconnected={handleDisconnect}
      className="interview-layout"
    >
      {/* Studio Header Bar */}
      <header className="interview-header-bar">
        <div className="interview-header-title">
          <div className="interview-live-badge">
            <span className="interview-live-dot" /> LIVE SESSION
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <Clock size={16} color="var(--accent)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fff' }}>
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: 'var(--accent)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Track: {theme}
          </span>

          <button
            onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
            className="btn"
            style={{
              background: isTranscriptOpen ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: isTranscriptOpen ? '#030305' : '#fff',
              border: '1px solid var(--border-color)',
              padding: '8px 16px',
              fontSize: '13px',
            }}
          >
            <MessageSquareText size={16} /> Transcript Log
          </button>

          <button
            onClick={handleDisconnect}
            className="btn"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: '8px 18px',
              fontSize: '13px',
            }}
          >
            <LogOut size={16} /> End Interview
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className={`interview-container ${isEditorOpen ? 'with-editor' : ''}`} style={{ position: 'relative' }}>
        {/* Left Pane: Candidate Video Feed & Vision HUD */}
        <div className="interview-video-pane">
          <VideoView onNewSegment={handleNewSegment} />
        </div>

        {/* Right Pane: AI Avatar & Control Center */}
        <div className="interview-control-pane">
          <AIAvatarPanel
            roomName={roomName}
            theme={theme}
            setIsEditorOpen={setIsEditorOpen}
            setIsTranscriptOpen={setIsTranscriptOpen}
          />

          {/* Media Devices Panel */}
          <div className="card glass-panel" style={{ padding: '20px' }}>
            <h4
              style={{
                margin: '0 0 14px 0',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Settings2 size={16} color="var(--accent)" /> Hardware & Media Devices
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Video size={14} /> Camera Input
                </span>
                <CustomDeviceSelect kind="videoinput" />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Mic size={14} /> Microphone Input
                </span>
                <CustomDeviceSelect kind="audioinput" />
              </div>
            </div>
          </div>
        </div>

        {/* Live Transcript Side Drawer */}
        <AnimatePresence>
          {isTranscriptOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="transcript-drawer"
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(10,10,18,0.9)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  <MessageSquareText size={18} color="var(--accent)" /> Live Transcript Log
                </div>
                <button
                  onClick={() => setIsTranscriptOpen(false)}
                  style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
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
                    <div key={log.id} className="transcript-message ai">
                      <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>AI / Candidate Speech</span>
                        <span>{log.time}</span>
                      </div>
                      <div>{log.text}</div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Code Editor Feature Component */}
      <CodeEditorFeature isOpen={isEditorOpen} setIsOpen={setIsEditorOpen} />

      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
