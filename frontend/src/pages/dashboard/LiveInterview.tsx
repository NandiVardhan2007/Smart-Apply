import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mic, PhoneOff, Video, MicOff, Code2, Send } from 'lucide-react';
import Editor from '@monaco-editor/react';

import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { useFaceAnalyzer } from '../../hooks/useFaceAnalyzer';

// The Web Speech API's SpeechRecognition constructor itself has no official
// TS lib types yet (only its event types — SpeechRecognitionEvent,
// SpeechRecognitionErrorEvent — ship in lib.dom.d.ts), so we declare a
// minimal shape for the parts this page actually uses.
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
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  }
}

type TranscriptEntry = { role: 'user' | 'assistant'; content: string };

/** A tiny live bar-graph — reads either real mic frequency data or, for the
 * agent's TTS (which has no accessible audio stream), a randomized shimmer. */
function AudioVisualizer({ stream, isSpeaking, maxHeight = 64 }: { stream?: MediaStream | null; isSpeaking?: boolean; maxHeight?: number }) {
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

export default function LiveInterview() {
  const [isActive, setIsActive] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'waiting'>('disconnected');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const [isCodingMode, setIsCodingMode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeContent, setCodeContent] = useState('// Write your solution here\n');

  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { modelsLoaded, getTelemetrySummary } = useFaceAnalyzer(videoRef, isActive);

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
      utterance.pitch = 0.5;

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
        englishVoices.find((v) => isMaleName(v.name)) ||
        englishVoices.find((v) => !isFemaleName(v.name)) ||
        englishVoices[englishVoices.length - 1];
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => {
        setAgentSpeaking(true);
        try {
          recognitionRef.current?.abort();
        } catch {
          // no-op — recognition may not have been running
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

  const handleStartInterview = async () => {
    if (!modelsLoaded) {
      showToast('info', 'Please wait for the AI models to finish loading…');
      return;
    }

    const roomName = `interview-${user?.id}-${Date.now()}`;
    setCurrentRoom(roomName);
    setStatus('connecting');
    setIsActive(true);

    await startLocalMedia();

    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseWsUrl = baseUrl.startsWith('http')
      ? baseUrl.replace(/^http/, 'ws') + '/interview/ws/chat'
      : `${wsProto}//${window.location.host}${baseUrl}/interview/ws/chat`;

    const ws = new WebSocket(`${baseWsUrl}?token=${encodeURIComponent(token ?? '')}`);

    ws.onopen = () => {
      setStatus('connected');
      const greeting = 'Hello, I am Ryan, your interviewer. Please introduce yourself when you are ready.';
      setTranscript((prev) => [...prev, { role: 'assistant', content: greeting }]);
      speakText(greeting);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
  };

  const handleCodeSubmit = () => {
    const formattedMessage = `I have submitted code in ${codeLanguage}:\n\n\`\`\`${codeLanguage}\n${codeContent}\n\`\`\``;
    setTranscript((prev) => [...prev, { role: 'user', content: formattedMessage }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: formattedMessage }));
      setStatus('waiting');
    }
  };

  const handleDisconnect = async () => {
    setIsActive(false);
    stopLocalMedia();
    wsRef.current?.close();
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();

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

  const lastUserLine = transcript.length > 0 && transcript[transcript.length - 1].role === 'user' ? transcript[transcript.length - 1].content : null;

  const statusLabel =
    status === 'disconnected' ? 'Agent offline' : status === 'connecting' ? 'Connecting to agent…' : agentSpeaking ? 'Agent is speaking…' : status === 'waiting' ? 'Agent is thinking…' : 'Agent is listening…';

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {!isActive ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ textAlign: 'center', maxWidth: 460, width: '100%' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <Video size={26} />
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 10 }}>Ready for your live interview?</h2>
            <p className="text-muted" style={{ fontSize: 14, marginBottom: 26, lineHeight: 1.6 }}>
              You're about to start a real-time video interview with an AI interviewer that reads your expressions. Make sure your
              camera and microphone are connected, and find a quiet, well-lit spot.
            </p>
            <button className="btn btn-primary btn-lg btn-block" onClick={handleStartInterview} disabled={status === 'connecting' || !modelsLoaded}>
              {status === 'connecting' ? (
                <>
                  <Loader2 size={18} className="spin" /> Connecting…
                </>
              ) : !modelsLoaded ? (
                <>
                  <Loader2 size={18} className="spin" /> Loading AI models…
                </>
              ) : (
                'Connect to agent'
              )}
            </button>
          </div>
        </div>
      ) : (
        <div
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
            transition: 'max-width 0.25s ease',
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 28, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {agentSpeaking ? (
                    <AudioVisualizer isSpeaking />
                  ) : status === 'waiting' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[0, 0.2, 0.4].map((delay) => (
                        <span key={delay} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', animation: `pulseDot 1.2s ${delay}s ease-in-out infinite` }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ width: 90, height: 5, borderRadius: 999, background: 'var(--accent)', opacity: 0.7 }} />
                  )}
                </div>
                <h3 style={{ fontSize: 16 }}>{statusLabel}</h3>
                {lastUserLine && (
                  <p className="text-muted" style={{ marginTop: 12, fontSize: 13.5, fontStyle: 'italic', maxWidth: 380 }}>
                    You: "{lastUserLine}"
                  </p>
                )}
              </div>

              <div
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
                  transition: 'width 0.25s ease',
                  background: 'var(--surface-sunken)',
                }}
              >
                <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              </div>
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, position: 'relative' }}>
              {isRecording && localStreamRef.current && (
                <div style={{ position: 'absolute', left: 24 }}>
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

          {isCodingMode && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: '#1a1c22', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid #2b2d33' }}>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  style={{ background: '#26282f', color: '#e4e5e9', border: '1px solid #3a3d45', padding: '5px 10px', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
                <button onClick={handleCodeSubmit} className="btn btn-primary btn-sm">
                  <Send size={13} /> Submit code
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <Editor
                  height="100%"
                  language={codeLanguage}
                  theme="vs-dark"
                  value={codeContent}
                  onChange={(val) => setCodeContent(val || '')}
                  options={{ minimap: { enabled: false }, fontSize: 14 }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
