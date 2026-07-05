import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { Loader2, Mic, PhoneOff, Video, MicOff, Code2, Send } from 'lucide-react';
import { useFaceAnalyzer } from '../../hooks/useFaceAnalyzer';
import Editor from '@monaco-editor/react';

// For TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const AudioVisualizer = ({ stream, isSpeaking, maxHeight = 80 }: { stream?: MediaStream | null, isSpeaking?: boolean, maxHeight?: number }) => {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let animationId: number;
    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    
    if (stream && isSpeaking) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 64;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const renderFrame = () => {
          analyser.getByteFrequencyData(dataArray);
          barsRef.current.forEach((bar, i) => {
            if (bar) {
              const val = dataArray[i * 2 + 1] || 0;
              const height = Math.max(10, (val / 255) * maxHeight);
              bar.style.height = `${height}px`;
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
           barsRef.current.forEach(bar => {
             if (bar) {
               const height = Math.max(16, Math.random() * maxHeight);
               bar.style.height = `${height}px`;
               bar.style.transition = 'height 0.1s ease';
             }
           });
           lastTime = time;
        }
        animationId = requestAnimationFrame(renderFrame);
      };
      renderFrame(performance.now());
    } else {
      barsRef.current.forEach(bar => {
        if (bar) {
          bar.style.height = '10px';
        }
      });
    }
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (source) source.disconnect();
      if (analyser) analyser.disconnect();
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [stream, isSpeaking, maxHeight]);

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {[0,1,2,3,4].map(i => (
        <div 
          key={i} 
          ref={el => { barsRef.current[i] = el; }}
          style={{
            width: '12px',
            background: 'var(--accent)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            boxShadow: 'var(--shadow-sm)',
            height: '10px',
            transition: stream ? 'none' : 'height 0.1s ease'
          }}
        />
      ))}
    </div>
  );
};
export default function LiveInterview() {
  const [isActive, setIsActive] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const [transcript, setTranscript] = useState<{role: string, content: string}[]>([]);
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
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const { modelsLoaded, getTelemetrySummary } = useFaceAnalyzer(videoRef, isActive);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (window.speechSynthesis) {
      // Force voices to load on mount for mobile browsers
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    
    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const result = event.results[event.resultIndex];
        if (result.isFinal) {
          const text = result[0].transcript;
          if (text && text.trim().length > 0) {
            handleUserSpeech(text.trim());
          }
        }
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      showToast('error', 'Your browser does not support Speech Recognition. Please use Chrome, Edge or Safari.');
    }
    
    return () => {
      stopLocalMedia();
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleUserSpeech = (text: string) => {
    setTranscript(prev => [...prev, { role: 'user', content: text }]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text }));
      setStatus('waiting');
    }
  };

  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Failed to get media devices', err);
      showToast('error', 'Could not access camera and microphone.');
    }
  };

  const stopLocalMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const handleStartInterview = async () => {
    if (!modelsLoaded) {
      showToast('info', 'Please wait for AI models to load...');
      return;
    }
    
    const roomName = `interview-${user?.id}-${Date.now()}`;
    setCurrentRoom(roomName);
    setStatus('connecting');
    setIsActive(true);
    
    await startLocalMedia();

    // Connect to WebSocket
    // The interview router is mounted at /api/interview (see
    // APIRouter(prefix="/api/interview") in routers/interview.py), so the
    // websocket route is /api/interview/ws/chat in both cases below.
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const baseWsUrl = baseUrl
      ? baseUrl.replace(/^http/, 'ws') + '/api/interview/ws/chat'
      : (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/api/interview/ws/chat';
      
    const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(token ?? '')}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setStatus('connected');
      // Speak initial greeting
      const greeting = "Hello, I am Ryan, your interviewer. Please introduce yourself when you are ready.";
      setTranscript(prev => [...prev, { role: 'assistant', content: greeting }]);
      speakText(greeting);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.text) {
          setStatus('connected');
          let textToSpeak = data.text;
          if (textToSpeak.includes('[OPEN_EDITOR]')) {
             textToSpeak = textToSpeak.replace('[OPEN_EDITOR]', '').trim();
             setIsCodingMode(true);
          }
          setTranscript(prev => [...prev, { role: 'assistant', content: textToSpeak }]);
          speakText(textToSpeak);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };
    
    ws.onerror = () => {
      showToast('error', 'WebSocket connection error');
      handleDisconnect();
    };
    
    ws.onclose = () => {
      setStatus('disconnected');
    };
    
    wsRef.current = ws;
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    
    const doSpeak = () => {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.rate = 1.0;
      utterance.pitch = 0.5; // Exceptionally low pitch to force deep/masculine tone
      
      // Pick an english voice if available
      const voices = window.speechSynthesis.getVoices();
      const isMaleName = (name: string) => {
        const lower = name.toLowerCase();
        return lower.includes('male') || lower.includes('boy') || lower.includes('man') || 
               ['daniel', 'david', 'arthur', 'mark', 'alex', 'fred', 'bruce', 'oliver', 'george', 'ryan', 'james', 'thomas', 'john'].some(n => lower.includes(n));
      };
      
      const isFemaleName = (name: string) => {
        const lower = name.toLowerCase();
        return lower.includes('female') || lower.includes('girl') || lower.includes('woman') ||
               ['siri', 'zira', 'samantha', 'hazel', 'victoria', 'karen', 'tessa', 'veena', 'moira', 'fiona', 'luciana', 'ava'].some(n => lower.includes(n));
      };

      const englishVoices = voices.filter(v => v.lang.startsWith('en-'));
      
      const preferredVoice = englishVoices.find(v => isMaleName(v.name)) || 
                             englishVoices.find(v => !isFemaleName(v.name)) ||
                             englishVoices[englishVoices.length - 1]; // Use last as fallback, first is often female default
                             
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.onstart = () => {
        setAgentSpeaking(true);
        // Ensure we are not recording while agent speaks
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch(e){}
          setIsRecording(false);
        }
      };
      
      utterance.onend = () => {
        setAgentSpeaking(false);
        // Auto-start listening after agent finishes speaking
        setTimeout(startListening, 100); // small delay to avoid capturing the end of the tts
      };
      
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      // Voices not loaded yet, wait for them
      window.speechSynthesis.onvoiceschanged = () => {
        doSpeak();
        // Clear listener so it doesn't trigger multiple times
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      doSpeak();
    }
  };

  const startListening = () => {
    if (recognitionRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        // Recognition might already be started
        console.log('Recognition start error', err);
      }
    }
  };
  
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCodeSubmit = () => {
    const formattedMessage = `I have submitted code in ${codeLanguage}:\n\n\`\`\`${codeLanguage}\n${codeContent}\n\`\`\``;
    setTranscript(prev => [...prev, { role: 'user', content: formattedMessage }]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: formattedMessage }));
      setStatus('waiting');
    }
  };

  const handleDisconnect = async () => {
    setIsActive(false);
    stopLocalMedia();
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    
    // Save report
    if (currentRoom) {
      try {
        const telemetry = getTelemetrySummary();
        const res = await apiFetch('/interview/analyze', {
          method: 'POST',
          body: JSON.stringify({
            user_id: user?.id || '',
            room_name: currentRoom,
            transcript,
            telemetry
          })
        });
        if (res.ok) {
          navigate(`/dashboard/live-interview/report/${currentRoom}`);
        } else {
          showToast('error', 'Failed to generate report.');
        }
      } catch (err) {
        showToast('error', 'Failed to generate report.');
      }
    }
  };

  return (
    <div className="live-interview-page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboard-page-header">
        <p>Real-time conversational interview with an AI Assistant analyzing expressions</p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {!isActive ? (
          <div className="settings-card" style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
            <Video size={48} style={{ color: 'var(--accent)', margin: '0 auto 1rem' }} />
            <h2 style={{ marginBottom: '1rem' }}>Ready for your video interview?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              You are about to start a real-time video interview. Ensure your camera and microphone are connected and you are in a well-lit, quiet environment.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleStartInterview}
              disabled={status === 'connecting' || !modelsLoaded}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {status === 'connecting' ? (
                <><Loader2 size={18} className="spin" /><span style={{ marginLeft: 8 }}>Connecting...</span></>
              ) : !modelsLoaded ? (
                <><Loader2 size={18} className="spin" /><span style={{ marginLeft: 8 }}>Loading AI Models...</span></>
              ) : (
                'Connect to Agent'
              )}
            </button>
          </div>
        ) : (
          <div
            className={`live-interview-container ${isCodingMode ? 'coding-mode' : ''}`}
            style={{ 
              width: '100%', 
              maxWidth: isCodingMode ? 1400 : 1000, 
              background: 'var(--bg-surface)', 
              borderRadius: 16, 
              border: '1px solid var(--border-color)', 
              display: 'flex', 
              position: 'relative',
              overflow: 'hidden',
              transition: 'max-width 0.3s ease'
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
                
                {/* Agent Visualizer */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '2rem', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {agentSpeaking ? (
                      <AudioVisualizer isSpeaking={true} />
                    ) : status === 'waiting' ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                         <div className="dot-pulse" style={{ animationDelay: '0s' }} />
                         <div className="dot-pulse" style={{ animationDelay: '0.2s' }} />
                         <div className="dot-pulse" style={{ animationDelay: '0.4s' }} />
                      </div>
                    ) : (
                      <div className="listening-bar" />
                    )}
                  </div>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {status === 'disconnected' ? 'Agent Offline' : 
                     status === 'connecting' ? 'Connecting to Agent...' : 
                     agentSpeaking ? 'Agent is speaking...' : 
                     status === 'waiting' ? 'Agent is thinking...' : 'Agent is listening...'}
                  </h3>
                  {transcript.length > 0 && transcript[transcript.length - 1].role === 'user' && (
                    <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', fontStyle: 'italic' }}>
                      You: "{transcript[transcript.length - 1].content}"
                    </p>
                  )}
                </div>

                {/* Local Video */}
                <div 
                  className="local-video-container"
                  style={{
                    position: 'absolute',
                    bottom: '2rem',
                    right: '2rem',
                    width: isCodingMode ? '180px' : '240px',
                    aspectRatio: '16/9',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    background: '#000',
                    border: '2px solid var(--border-color)',
                    transition: 'width 0.3s ease'
                  }}
                >
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                  />
                </div>
              </div>

              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                {/* User Mic Visualizer */}
                {isRecording && localStreamRef.current && (
                  <div style={{ position: 'absolute', left: '2rem' }}>
                    <AudioVisualizer stream={localStreamRef.current} isSpeaking={true} maxHeight={40} />
                  </div>
                )}
                <button 
                  className={`btn ${isRecording ? 'btn-primary' : ''}`}
                  onClick={isRecording ? stopListening : startListening}
                  disabled={agentSpeaking || status !== 'connected'}
                  style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                
                <button 
                  className={`btn`}
                  onClick={() => setIsCodingMode(!isCodingMode)}
                  style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCodingMode ? 'var(--primary)' : 'transparent', color: isCodingMode ? 'var(--primary-foreground)' : 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                  title="Toggle Code Editor"
                >
                  <Code2 size={20} />
                </button>

                <button 
                  className="btn" 
                  onClick={handleDisconnect}
                  style={{ background: 'var(--error)', color: 'white', borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="End Interview"
                >
                  <PhoneOff size={20} />
                </button>
              </div>
            </div>
            
            {isCodingMode && (
              <div className="editor-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', background: '#1e1e1e', minHeight: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid #333', background: '#252526' }}>
                  <select 
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    style={{ background: '#3c3c3c', color: '#fff', border: '1px solid #555', padding: '4px 8px', borderRadius: 4, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <button onClick={handleCodeSubmit} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Send size={14} /> Submit Code
                  </button>
                </div>
                <div style={{ flex: 1, paddingBottom: '10px' }}>
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
      <style>{`
        .speaking-bar {
          width: 12px;
          background: var(--accent);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          animation: bounce 1s ease-in-out infinite;
          box-shadow: var(--shadow-sm);
        }
        .speaking-bar:nth-child(1) { animation-delay: 0.1s; height: 40px; }
        .speaking-bar:nth-child(2) { animation-delay: 0.2s; height: 60px; }
        .speaking-bar:nth-child(3) { animation-delay: 0.3s; height: 80px; }
        .speaking-bar:nth-child(4) { animation-delay: 0.4s; height: 60px; }
        .speaking-bar:nth-child(5) { animation-delay: 0.5s; height: 40px; }
        @keyframes bounce {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.1); }
        }
        .dot-pulse {
          width: 16px;
          height: 16px;
          background: #000;
          border-radius: 50%;
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(0.6); opacity: 0.5; }
          50% { transform: scale(1); opacity: 1; }
        }
        .listening-bar {
          width: 100px;
          height: 6px;
          background: var(--accent);
          border: 1px solid var(--border-color);
          border-radius: 3px;
          animation: listenPulse 2s infinite ease-in-out;
          box-shadow: var(--shadow-sm);
        }
        @keyframes listenPulse {
          0%, 100% { width: 100px; opacity: 1; }
          50% { width: 140px; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
