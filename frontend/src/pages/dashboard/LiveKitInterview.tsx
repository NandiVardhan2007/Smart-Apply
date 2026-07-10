import { useState, useEffect } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar, useMediaDeviceSelect, ParticipantTile, useLocalParticipant, useRoomContext, useDataChannel, VideoTrack } from '@livekit/components-react';
import '@livekit/components-styles';
import { RoomEvent, Track } from 'livekit-client';
import type { TranscriptionSegment, Participant, TrackPublication } from 'livekit-client';
import * as faceapi from '@vladmandic/face-api';
import { Mic, Video, LogOut, Bot, Play } from 'lucide-react';
import Editor from '@monaco-editor/react';

import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

function CodeEditorFeature({ theme }: { theme: string }) {
  const { localParticipant } = useLocalParticipant();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('def solution():\n    pass');
  const [language, setLanguage] = useState('python');

  if (theme !== 'Technical') return null;

  const handleSubmit = () => {
    if (localParticipant) {
      const payload = new TextEncoder().encode(code);
      localParticipant.publishData(payload, { topic: 'code_submission' });
      showToast('success', 'Code submitted to AI!');
      setIsOpen(false);
    }
  };

  return (
    <>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={() => setIsOpen(true)}>
        Open Code Editor
      </button>
      
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '80%', height: '80%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <h3 style={{ margin: 0 }}>Live Code Editor</h3>
                 <select 
                   value={language} 
                   onChange={(e) => setLanguage(e.target.value)}
                   style={{ padding: '6px 12px', borderRadius: 'var(--radius)', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                 >
                   <option value="python" style={{ color: '#000', background: '#fff' }}>Python</option>
                   <option value="javascript" style={{ color: '#000', background: '#fff' }}>JavaScript</option>
                   <option value="typescript" style={{ color: '#000', background: '#fff' }}>TypeScript</option>
                   <option value="java" style={{ color: '#000', background: '#fff' }}>Java</option>
                   <option value="cpp" style={{ color: '#000', background: '#fff' }}>C++</option>
                 </select>
               </div>
               <button onClick={() => setIsOpen(false)} className="btn btn-ghost" style={{ padding: '8px 16px' }}>Close</button>
             </div>
             <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
               <Editor
                 height="100%"
                 language={language}
                 theme="vs-dark"
                 value={code}
                 onChange={(val) => setCode(val || '')}
                 options={{ minimap: { enabled: false } }}
               />
             </div>
             <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
               <button className="btn btn-primary" onClick={handleSubmit}>Submit Code to AI</button>
             </div>
          </div>
        </div>
      )}
    </>
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
        padding: '12px 16px', 
        borderRadius: 'var(--radius)', 
        border: '1px solid var(--border-color)', 
        background: 'var(--bg-input)', 
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2338bdf8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 16px top 50%',
        backgroundSize: '12px auto'
      }}
    >
      {devices.map(device => (
        <option key={device.deviceId} value={device.deviceId} style={{ color: '#000000', background: '#ffffff' }}>
          {device.label || `Device ${device.deviceId}`}
        </option>
      ))}
    </select>
  );
}

function LiveSubtitles() {
  const room = useRoomContext();
  const [segments, setSegments] = useState<Record<string, TranscriptionSegment>>({});

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
      publication?: TrackPublication
    ) => {
      setSegments(prev => {
        const next = { ...prev };
        for (const segment of segments) {
          next[segment.id] = segment;
        }
        return next;
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room]);

  const activeSegments = Object.values(segments)
    .sort((a, b) => a.firstReceivedTime - b.firstReceivedTime)
    .slice(-1); // Only show the most recent segment to save screen space!

  if (activeSegments.length === 0) return null;

  return (
    <div style={{
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
      justifyContent: 'flex-end',
      maxHeight: '35%',
      overflow: 'hidden'
    }}>
      {activeSegments.map(seg => (
        <div key={seg.id} style={{
          background: 'linear-gradient(135deg, rgba(20, 21, 31, 0.85), rgba(0, 0, 0, 0.85))',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '16px',
          marginBottom: '8px',
          fontSize: '15px',
          fontWeight: 500,
          backdropFilter: 'blur(8px)',
          display: 'inline-block',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(0, 255, 204, 0.25)',
          maxWidth: '100%',
          wordWrap: 'break-word',
          letterSpacing: '0.3px',
          lineHeight: '1.4',
          animation: 'fadeInUp 0.3s ease-out forwards'
        }}>
          {seg.text}
        </div>
      ))}
    </div>
  );
}

function FacialAnalysisHUD() {
  const [focus, setFocus] = useState(0);
  const [expression, setExpression] = useState('Loading Models...');
  const [posture, setPosture] = useState('Tracking...');

  useEffect(() => {
    let active = true;
    let interval: any;

    const startVision = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        
        if (!active) return;
        setExpression('Detecting Face...');

        interval = setInterval(async () => {
          const video = document.querySelector('video');
          if (!video || video.paused || video.ended || video.readyState < 2) return;

          try {
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
            
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
              setExpression('No Face Detected');
              setPosture('Unknown');
            }
          } catch (err) {
            console.error("Face detection error:", err);
          }
        }, 150);
      } catch (err) {
        console.error("Failed to load FaceAPI models", err);
      }
    };

    startVision();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      top: 16, right: 16,
      padding: '16px',
      borderRadius: 'var(--radius)',
      color: 'var(--accent)',
      fontFamily: 'var(--font-mono)',
      width: '200px',
      zIndex: 10
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', borderBottom: '1px solid var(--border-accent)', paddingBottom: '8px', color: 'var(--text-primary)' }}>
        CLIENT-SIDE ML ACTIVE
      </h3>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>FOCUS LEVEL</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{focus.toFixed(1)}%</div>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>EXPRESSION</div>
        <div style={{ fontSize: '16px', color: 'var(--accent)' }}>{expression}</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>POSTURE</div>
        <div style={{ fontSize: '16px', color: 'var(--accent)' }}>{posture}</div>
      </div>
    </div>
  );
}

function VideoView() {
  const { localParticipant, cameraTrack } = useLocalParticipant();
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
      {localParticipant && cameraTrack?.track && (
        <VideoTrack trackRef={{ participant: localParticipant, source: Track.Source.Camera, publication: cameraTrack }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {!cameraTrack?.track && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Camera starting...
        </div>
      )}
      <FacialAnalysisHUD />
      <LiveSubtitles />
      
      <div style={{
        position: 'absolute',
        top: '20%', left: '30%', right: '30%', bottom: '20%',
        border: '2px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)',
        pointerEvents: 'none',
        boxShadow: 'var(--shadow-glow) inset',
        zIndex: 5
      }}>
        <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', borderTopLeftRadius: 'var(--radius-lg)' }}></div>
        <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '4px solid var(--accent)', borderRight: '4px solid var(--accent)', borderTopRightRadius: 'var(--radius-lg)' }}></div>
        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', borderBottomLeftRadius: 'var(--radius-lg)' }}></div>
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '4px solid var(--accent)', borderRight: '4px solid var(--accent)', borderBottomRightRadius: 'var(--radius-lg)' }}></div>
      </div>
    </div>
  );
}

export default function LiveKitInterview() {
  const [token, setToken] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [theme, setTheme] = useState<string>('HR');
  const { showToast } = useToast();

  const handleStart = async () => {
    setStatus('connecting');
    try {
      const res = await apiFetch<{token: string, room_name: string}>(`/livekit/token?theme=${theme}`);
      if (!res.ok) throw new Error('Failed to fetch token');
      const data = res.data;
      setToken(data.token);
      setRoomName(data.room_name);
      setStatus('connected');
    } catch (err) {
      console.error(err);
      showToast('error', 'Could not start the LiveKit interview.');
      setStatus('idle');
    }
  };

  const handleDisconnect = () => {
    setToken('');
    setStatus('idle');
  };

  if (status === 'idle' || status === 'connecting') {
    return (
      <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="card" style={{ 
          textAlign: 'center', 
          maxWidth: '500px',
          width: '100%',
          padding: '48px'
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)', color: 'var(--primary-foreground)' }}>
             <Bot size={32} />
          </div>
          <h2 className="text-accent" style={{ fontSize: '28px', marginBottom: '8px' }}>AI Interview Coach</h2>
          <p className="text-muted" style={{ marginTop: '12px', fontSize: '16px', lineHeight: 1.5 }}>
            Start a realistic, voice-to-voice interview with our advanced AI agent featuring real-time facial analysis and transcription.
          </p>
          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
              <label htmlFor="themeSelect" style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginLeft: '4px' }}>Interview Theme</label>
              <select 
                id="themeSelect" 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                style={{ 
                  padding: '14px 16px', 
                  borderRadius: 'var(--radius)', 
                  border: '1px solid var(--border-color)', 
                  background: 'var(--bg-input)', 
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2338bdf8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 16px top 50%',
                  backgroundSize: '12px auto'
                }}
              >
                <option value="HR" style={{ color: '#000000', background: '#ffffff' }}>HR / General (Friendly Female)</option>
                <option value="Technical" style={{ color: '#000000', background: '#ffffff' }}>Technical (Female)</option>
                <option value="Behavioral" style={{ color: '#000000', background: '#ffffff' }}>Behavioral (Professional British)</option>
                <option value="Executive" style={{ color: '#000000', background: '#ffffff' }}>Executive (Stern & Demanding)</option>
                <option value="Creative" style={{ color: '#000000', background: '#ffffff' }}>Creative (Enthusiastic & Casual)</option>
              </select>
            </div>
            
            <button 
              onClick={handleStart}
              disabled={status === 'connecting'}
              className="btn btn-primary"
              style={{ width: '100%', padding: '16px' }}
            >
              {status === 'connecting' ? 'Connecting to Secure Room...' : <><Play size={18} /> Start Live Interview</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      connect={true}
      onDisconnected={handleDisconnect}
      style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}
    >
      <div style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', boxSizing: 'border-box', overflow: 'hidden' }}>
        
        {/* Left Side: User Video + Facial Analysis */}
        <div style={{ flex: 2, height: '100%' }}>
           <VideoView />
        </div>

        {/* Right Side: AI Visualizer & Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
           <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)', color: 'var(--primary-foreground)' }}>
                 <Bot size={40} />
              </div>
              <h2 style={{ marginBottom: 16 }}>AI Interviewer</h2>
              <p className="text-muted">Room: {roomName}</p>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: 'auto' }}>Theme: {theme}</p>
              
              <div style={{ width: '100%', marginTop: '24px' }}>
                 <VoiceAssistantControlBar />
                 <CodeEditorFeature theme={theme} />
              </div>
           </div>

           {/* Mic / Cam Selectors */}
           <div className="card" style={{ padding: '24px' }}>
             <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Device Settings</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <Video size={18} /> Camera
                  </span>
                  <CustomDeviceSelect kind="videoinput" />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <Mic size={18} /> Microphone
                  </span>
                  <CustomDeviceSelect kind="audioinput" />
               </div>
               <button 
                 onClick={handleDisconnect}
                 className="btn"
                 style={{ marginTop: '8px', width: '100%', background: '#ef4444', color: '#ffffff', border: 'none' }}
               >
                 <LogOut size={18} /> End Interview
               </button>
             </div>
           </div>
        </div>

        <RoomAudioRenderer />
      </div>
    </LiveKitRoom>
  );
}
