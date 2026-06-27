import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { Loader2, Mic, PhoneOff, Video, MicOff } from 'lucide-react';
import { useFaceAnalyzer } from '../../hooks/useFaceAnalyzer';

// For TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function LiveInterview() {
  const [isActive, setIsActive] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const [transcript, setTranscript] = useState<{role: string, content: string}[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  
  const { modelsLoaded, getTelemetrySummary } = useFaceAnalyzer(videoRef, isActive);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text && text.trim().length > 0) {
          handleUserSpeech(text);
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
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const wsUrl = baseUrl 
      ? baseUrl.replace(/^http/, 'ws') + '/interview/ws/chat'
      : (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/api/interview/ws/chat';
      
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
          setTranscript(prev => [...prev, { role: 'assistant', content: data.text }]);
          speakText(data.text);
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
    
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Pick an english voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Male')) || 
                           voices.find(v => v.lang.startsWith('en-'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onstart = () => {
      setAgentSpeaking(true);
      // Ensure we are not recording while agent speaks
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.abort();
      }
    };
    
    utterance.onend = () => {
      setAgentSpeaking(false);
      // Auto-start listening after agent finishes speaking
      startListening();
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (recognitionRef.current && !agentSpeaking && status === 'connected') {
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
        await apiFetch('/interview/analyze', {
          method: 'POST',
          body: JSON.stringify({
            user_id: user?.id || '',
            room_name: currentRoom,
            transcript,
            telemetry
          })
        });
        navigate(`/dashboard/live-interview/report/${currentRoom}`);
      } catch (err) {
        showToast('error', 'Failed to generate report.');
      }
    }
  };

  return (
    <div className="live-interview-page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboard-page-header">
        <h1>Live Video Interview</h1>
        <p>Real-time conversational interview with an AI Assistant analyzing expressions</p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {!isActive ? (
          <div className="settings-card" style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
            <Video size={48} style={{ color: 'var(--accent-start)', margin: '0 auto 1rem' }} />
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
            style={{ 
              width: '100%', 
              maxWidth: 1000, 
              height: 600, 
              background: 'var(--bg-surface)', 
              borderRadius: 16, 
              border: '1px solid var(--border-color)', 
              display: 'flex', 
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
              
              {/* Agent Visualizer */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '2rem', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {agentSpeaking ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                       {[1,2,3,4,5].map(i => (
                         <div key={i} style={{ 
                           width: '12px', 
                           height: `${Math.max(20, Math.random() * 80)}px`, 
                           background: 'var(--accent-start)', 
                           borderRadius: '6px',
                           transition: 'height 0.1s ease'
                         }} />
                       ))}
                    </div>
                  ) : (
                    <div style={{ width: '100px', height: '4px', background: 'var(--border-color)', borderRadius: '2px' }} />
                  )}
                </div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  {status === 'disconnected' ? 'Agent Offline' : 
                   status === 'connecting' ? 'Connecting to Agent...' : 
                   agentSpeaking ? 'Agent is speaking...' : 
                   status === 'waiting' ? 'Agent is thinking...' : 'Agent is listening...'}
                </h3>
              </div>

              {/* Local Video */}
              <div style={{
                position: 'absolute',
                bottom: '2rem',
                right: '2rem',
                width: '240px',
                aspectRatio: '16/9',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                background: '#000',
                border: '2px solid var(--border-color)'
              }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                />
              </div>

            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
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
                className="btn" 
                onClick={handleDisconnect}
                style={{ background: 'var(--error)', color: 'white', borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="End Interview"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
