import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mic, PhoneOff, Video, MicOff, Code2 } from 'lucide-react';

import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { useFaceAnalyzer } from '../../hooks/useFaceAnalyzer';
import { useVAD } from '../../hooks/useVAD';
import InterviewConfigModal, { type InterviewConfig } from '../../components/InterviewConfigModal';
import InterviewerAvatar, { type AvatarState } from '../../components/InterviewerAvatar';
import CodeExecutionPanel from '../../components/CodeExecutionPanel';

// ── Web Speech API types ──
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
  interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: any) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: any) => void) | null;
  }
}

type TranscriptEntry = { role: 'user' | 'assistant'; content: string };

/* ────────────────────────────────────────────────────────────
 * AudioVisualizer — tiny bar-graph for the user's mic input
 * ──────────────────────────────────────────────────────────── */

function AudioVisualizer({
  stream,
  isSpeaking,
  maxHeight = 64,
}: {
  stream?: MediaStream | null;
  isSpeaking?: boolean;
  maxHeight?: number;
}) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let animationId: number;
    let audioContext: AudioContext | undefined;
    let analyser: AnalyserNode | undefined;
    let source: MediaStreamAudioSourceNode | undefined;

    if (stream && isSpeaking) {
      try {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 64;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const renderFrame = () => {
          analyser!.getByteFrequencyData(dataArray);
          barsRef.current.forEach((bar, i) => {
            if (bar) {
              const val = dataArray[i * 2 + 1] || 0;
              bar.style.height = `${Math.max(6, (val / 255) * maxHeight)}px`;
            }
          });
          animationId = requestAnimationFrame(renderFrame);
        };
        renderFrame();
      } catch (err) {
        console.error('AudioContext error', err);
      }
    } else if (isSpeaking) {
      let lastTime = performance.now();
      const renderFrame = (time: number) => {
        if (time - lastTime > 100) {
          barsRef.current.forEach((bar) => {
            if (bar) {
              bar.style.transition = 'height 0.1s ease';
              bar.style.height = `${Math.max(10, Math.random() * maxHeight)}px`;
            }
          });
          lastTime = time;
        }
        animationId = requestAnimationFrame(renderFrame);
      };
      renderFrame(performance.now());
    } else {
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = '6px';
      });
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      source?.disconnect();
      analyser?.disconnect();
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [stream, isSpeaking, maxHeight]);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: maxHeight }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          style={{ width: 6, background: 'var(--accent)', borderRadius: 999, height: 6, transition: stream ? 'none' : undefined }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * LiveInterview — main page component
 * ──────────────────────────────────────────────────────────── */

export default function LiveInterview() {
  // ── Connection & interview state ──
  const [phase, setPhase] = useState<'config' | 'active'>('config');
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'waiting'>('disconnected');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  // ── Coding mode ──
  const [isCodingMode, setIsCodingMode] = useState(false);

  // ── Auth & navigation ──
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // ── Refs ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // ── Face analyzer ──
  const { modelsLoaded, getTelemetrySummary } = useFaceAnalyzer(videoRef, phase === 'active');

  // ── VAD (Voice Activity Detection) ──
  const { isSpeaking: vadSpeaking, rmsLevel } = useVAD(
    localStreamRef.current,
    phase === 'active' && status === 'connected',
  );

  // ── VAD-based interruption ──
  // When the user starts speaking while the agent is still speaking,
  // immediately cancel TTS and switch to listening mode.
  const agentSpeakingRef = useRef(agentSpeaking);
  agentSpeakingRef.current = agentSpeaking;

  useEffect(() => {
    if (vadSpeaking && agentSpeakingRef.current) {
      // User interrupted the AI — cancel TTS immediately
      window.speechSynthesis?.cancel();
      setAgentSpeaking(false);

      // Start recognition to capture what they're saying
      if (recognitionRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch {
          // Recognition may already be running
        }
      }
    }
  }, [vadSpeaking]);

  // ── Speech recognition setup ──
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const result = event.results[event.resultIndex];
        if (result.isFinal) {
          const text = result[0].transcript;
          if (text?.trim()) handleUserSpeech(text.trim());
        }
      };
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      showToast('error', 'Your browser does not support speech recognition. Please use Chrome, Edge, or Safari.');
    }

    return () => {
      stopLocalMedia();
      wsRef.current?.close();
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ──

  const handleUserSpeech = (text: string) => {
    setTranscript((prev) => [...prev, { role: 'user', content: text }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text }));
      setStatus('waiting');
    }
  };

  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Failed to get media devices', err);
      showToast('error', 'Could not access camera and microphone.');
    }
  };

  const stopLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  };

  const startListening = () => {
    if (recognitionRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.log('Recognition start error', err);
      }
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;

    const doSpeak = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const isMaleName = (name: string) => {
        const lower = name.toLowerCase();
        return (
          lower.includes('male') ||
          lower.includes('man') ||
          ['daniel', 'david', 'arthur', 'mark', 'alex', 'fred', 'bruce', 'oliver', 'george', 'ryan', 'james', 'thomas', 'john'].some((n) =>
            lower.includes(n)
          )
        );
      };
      const isFemaleName = (name: string) => {
        const lower = name.toLowerCase();
        return (
          lower.includes('female') ||
          lower.includes('woman') ||
          ['siri', 'zira', 'samantha', 'hazel', 'victoria', 'karen', 'tessa', 'veena', 'moira', 'fiona', 'luciana', 'ava'].some((n) =>
            lower.includes(n)
          )
        );
      };

      const englishVoices = voices.filter((v) => v.lang.startsWith('en-'));
      const preferredVoice =
        englishVoices.find((v) => (v.name.includes('Google') || v.name.includes('Premium')) && isMaleName(v.name)) ||
        englishVoices.find((v) => isMaleName(v.name)) ||
        englishVoices.find((v) => !isFemaleName(v.name)) ||
        englishVoices[englishVoices.length - 1];
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => {
        setAgentSpeaking(true);
        try {
          recognitionRef.current?.abort();
        } catch {
          // no-op
        }
        setIsRecording(false);
      };

      utterance.onend = () => {
        setAgentSpeaking(false);
        setTimeout(startListening, 100);
      };

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        doSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      doSpeak();
    }
  };

  // ── Start interview (called from config modal) ──
  const handleStartInterview = useCallback(async (config: InterviewConfig) => {
    if (!modelsLoaded) {
      showToast('info', 'Please wait for the AI models to finish loading…');
      return;
    }

    const roomName = `interview-${user?.id}-${Date.now()}`;
    setCurrentRoom(roomName);
    setStatus('connecting');
    setPhase('active');

    await startLocalMedia();

    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseWsUrl = baseUrl.startsWith('http')
      ? baseUrl.replace(/^http/, 'ws') + '/interview/ws/chat'
      : `${wsProto}//${window.location.host}${baseUrl}/interview/ws/chat`;

    const ws = new WebSocket(`${baseWsUrl}?token=${encodeURIComponent(token ?? '')}`);

    ws.onopen = () => {
      setStatus('connected');

      // Send config as the first message
      ws.send(JSON.stringify({
        type: 'config',
        interview_type: config.interviewType,
        custom_type: config.customType,
        job_description: config.jobDescription,
        persona: config.persona,
      }));

      // Speak the greeting (the backend sends a config_ack, not a text greeting)
      const greeting = 'Hello, I am Ryan, your interviewer. Please introduce yourself when you are ready.';
      setTranscript((prev) => [...prev, { role: 'assistant', content: greeting }]);
      speakText(greeting);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip config acknowledgement messages
        if (data.type === 'config_ack') return;

        if (data.text) {
          setStatus('connected');
          let textToSpeak: string = data.text;
          if (textToSpeak.includes('[OPEN_EDITOR]')) {
            textToSpeak = textToSpeak.replace('[OPEN_EDITOR]', '').trim();
            setIsCodingMode(true);
          }
          setTranscript((prev) => [...prev, { role: 'assistant', content: textToSpeak }]);
          speakText(textToSpeak);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onerror = () => {
      showToast('error', 'WebSocket connection error.');
      handleDisconnect();
    };

    ws.onclose = () => setStatus('disconnected');

    wsRef.current = ws;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsLoaded, user, token]);

  // ── Code submission from CodeExecutionPanel ──
  const handleCodeSubmit = useCallback((language: string, code: string, result: { stdout: string; stderr: string; exit_code: number } | null) => {
    let formattedMessage = `I have submitted code in ${language}:\n\n\`\`\`${language}\n${code}\n\`\`\``;

    if (result) {
      formattedMessage += `\n\n**Execution Output (exit code ${result.exit_code}):**\n`;
      if (result.stdout) formattedMessage += `\`\`\`\nSTDOUT:\n${result.stdout}\n\`\`\`\n`;
      if (result.stderr) formattedMessage += `\`\`\`\nSTDERR:\n${result.stderr}\n\`\`\`\n`;
      if (!result.stdout && !result.stderr) formattedMessage += '(no output)\n';
    }

    setTranscript((prev) => [...prev, { role: 'user', content: formattedMessage }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: formattedMessage }));
      setStatus('waiting');
    }
  }, []);

  // ── Disconnect ──
  const handleDisconnect = async () => {
    setPhase('config');
    stopLocalMedia();
    wsRef.current?.close();
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
    setIsCodingMode(false);

    if (currentRoom) {
      try {
        const telemetry = getTelemetrySummary();
        const res = await apiFetch('/interview/analyze', {
          method: 'POST',
          body: JSON.stringify({ user_id: user?.id || '', room_name: currentRoom, transcript, telemetry }),
        });
        if (res.ok) {
          navigate(`/dashboard/live-interview/report/${currentRoom}`);
        } else {
          showToast('error', 'Failed to generate your report.');
        }
      } catch {
        showToast('error', 'Failed to generate your report.');
      }
    }
  };

  // ── Derived state ──
  const lastUserLine = transcript.length > 0 && transcript[transcript.length - 1].role === 'user' ? transcript[transcript.length - 1].content : null;

  const statusLabel =
    status === 'disconnected' ? 'Agent offline'
    : status === 'connecting' ? 'Connecting to agent…'
    : agentSpeaking ? 'Agent is speaking…'
    : status === 'waiting' ? 'Agent is thinking…'
    : 'Agent is listening…';

  const avatarState: AvatarState =
    agentSpeaking ? 'speaking'
    : status === 'waiting' ? 'thinking'
    : isRecording ? 'listening'
    : 'idle';

  // Simulated RMS for avatar lip-sync (we don't have access to TTS audio stream
  // from speechSynthesis, so we generate a convincing random value while speaking)
  const avatarRmsRef = useRef(0);
  useEffect(() => {
    if (!agentSpeaking) {
      avatarRmsRef.current = 0;
      return;
    }
    const interval = setInterval(() => {
      avatarRmsRef.current = 0.05 + Math.random() * 0.12;
    }, 80);
    return () => clearInterval(interval);
  }, [agentSpeaking]);

  // ── Render ──
  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {phase === 'config' ? (
        <InterviewConfigModal
          onStart={handleStartInterview}
          modelsLoaded={modelsLoaded}
          isConnecting={status === 'connecting'}
        />
      ) : (
        <div
          className="live-interview-layout"
          style={{
            flex: 1,
            display: 'flex',
            width: '100%',
            maxWidth: isCodingMode ? 1400 : 1000,
            margin: '0 auto',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            transition: 'max-width var(--transition-slow)',
          }}
        >
          {/* ── Left: Avatar + Controls ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative' }}>
              <div style={{ textAlign: 'center' }}>
                {/* Avatar */}
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <InterviewerAvatar
                    state={avatarState}
                    rmsLevel={agentSpeaking ? avatarRmsRef.current : rmsLevel}
                    size={isCodingMode ? 180 : 260}
                  />
                </div>

                <h3 style={{ fontSize: 16 }}>{statusLabel}</h3>
                {lastUserLine && (
                  <p className="text-muted" style={{ marginTop: 12, fontSize: 13.5, fontStyle: 'italic', maxWidth: 380 }}>
                    You: "{lastUserLine.length > 120 ? lastUserLine.slice(0, 120) + '…' : lastUserLine}"
                  </p>
                )}
              </div>

              {/* Self-view camera */}
              <div
                className="live-interview-video-container"
                style={{
                  position: 'absolute',
                  bottom: 24,
                  right: 24,
                  width: isCodingMode ? 160 : 220,
                  aspectRatio: '16 / 9',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  border: '2px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  transition: 'width var(--transition-slow)',
                  background: 'var(--surface-sunken)',
                }}
              >
                <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              </div>
            </div>

            {/* ── Controls bar ── */}
            <div className="controls-bar" style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, position: 'relative' }}>
              {isRecording && localStreamRef.current && (
                <div className="local-visualizer" style={{ position: 'absolute', left: 24 }}>
                  <AudioVisualizer stream={localStreamRef.current} isSpeaking maxHeight={32} />
                </div>
              )}

              <button
                onClick={isRecording ? stopListening : startListening}
                disabled={agentSpeaking || status !== 'connected'}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                className="btn-icon"
                style={{
                  borderRadius: '50%',
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-strong)',
                  background: isRecording ? 'var(--accent)' : 'var(--surface)',
                  color: isRecording ? 'var(--accent-ink)' : 'var(--ink)',
                  cursor: 'pointer',
                }}
              >
                {isRecording ? <Mic size={19} /> : <MicOff size={19} />}
              </button>

              <button
                onClick={() => setIsCodingMode((v) => !v)}
                aria-label="Toggle code editor"
                className="btn-icon"
                style={{
                  borderRadius: '50%',
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-strong)',
                  background: isCodingMode ? 'var(--accent)' : 'var(--surface)',
                  color: isCodingMode ? 'var(--accent-ink)' : 'var(--ink)',
                  cursor: 'pointer',
                }}
              >
                <Code2 size={19} />
              </button>

              <button
                onClick={handleDisconnect}
                aria-label="End interview"
                className="btn-icon"
                style={{
                  borderRadius: '50%',
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: 'var(--danger)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <PhoneOff size={19} />
              </button>
            </div>
          </div>

          {/* ── Right: Code editor (when active) ── */}
          {isCodingMode && (
            <CodeExecutionPanel onSubmit={handleCodeSubmit} />
          )}
        </div>
      )}
      <style>{`
        .live-interview-layout {
          flex-direction: row;
        }
        @media (max-width: 900px) {
          .live-interview-layout {
            flex-direction: column !important;
          }
          .live-interview-layout > div:first-child {
            flex: ${isCodingMode ? '0 0 40%' : '1'} !important;
            min-height: ${isCodingMode ? '250px' : 'auto'};
          }
          .live-interview-layout > div:nth-child(2) {
            flex: 1 !important;
            border-left: none !important;
            border-top: 1px solid var(--border);
          }
          .live-interview-video-container {
            width: 110px !important;
            bottom: auto !important;
            top: 16px !important;
            right: 16px !important;
            z-index: 10;
          }
        }
        @media (max-width: 450px) {
          .controls-bar {
            gap: 12px !important;
            padding: 12px 8px !important;
          }
          .controls-bar .btn-icon {
            width: 44px !important;
            height: 44px !important;
          }
          .local-visualizer {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
