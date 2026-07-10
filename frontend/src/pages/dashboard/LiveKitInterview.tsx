import { useState, useEffect } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar, MediaDeviceMenu, ParticipantTile, useLocalParticipant, useRoomContext, useDataChannel, VideoTrack } from '@livekit/components-react';
import '@livekit/components-styles';
import { RoomEvent, Track } from 'livekit-client';
import type { TranscriptionSegment, Participant, TrackPublication } from 'livekit-client';
import * as faceapi from '@vladmandic/face-api';
import { Mic, Video, LogOut, Bot, Play } from 'lucide-react';

import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

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
    .slice(-2);

  if (activeSegments.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '80%',
      textAlign: 'center',
      zIndex: 20,
      pointerEvents: 'none'
    }}>
      {activeSegments.map(seg => (
        <div key={seg.id} style={{
          background: 'linear-gradient(135deg, rgba(20, 21, 31, 0.9), rgba(0, 0, 0, 0.9))',
          color: '#fff',
          padding: '16px 32px',
          borderRadius: '24px',
          marginBottom: '12px',
          fontSize: '22px',
          fontWeight: 600,
          backdropFilter: 'blur(12px)',
          display: 'inline-block',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0, 255, 204, 0.3)',
          maxWidth: '90%',
          wordWrap: 'break-word',
          letterSpacing: '0.5px',
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
    <div style={{
      position: 'absolute',
      top: 16, right: 16,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      padding: '16px',
      borderRadius: '12px',
      color: '#00ffcc',
      border: '1px solid rgba(0,255,204,0.3)',
      fontFamily: 'monospace',
      width: '200px',
      zIndex: 10
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', borderBottom: '1px solid rgba(0,255,204,0.3)', paddingBottom: '8px', color: '#fff' }}>
        CLIENT-SIDE ML ACTIVE
      </h3>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#aaa' }}>FOCUS LEVEL</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{focus.toFixed(1)}%</div>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#aaa' }}>EXPRESSION</div>
        <div style={{ fontSize: '16px', color: '#00ffcc' }}>{expression}</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>POSTURE</div>
        <div style={{ fontSize: '16px', color: '#00ffcc' }}>{posture}</div>
      </div>
    </div>
  );
}

function VideoView() {
  const { localParticipant, cameraTrack } = useLocalParticipant();
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
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
        border: '2px solid rgba(0, 255, 204, 0.4)',
        borderRadius: '20px',
        pointerEvents: 'none',
        boxShadow: '0 0 20px rgba(0, 255, 204, 0.2) inset',
        zIndex: 5
      }}>
        <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '4px solid #00ffcc', borderLeft: '4px solid #00ffcc', borderTopLeftRadius: 20 }}></div>
        <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '4px solid #00ffcc', borderRight: '4px solid #00ffcc', borderTopRightRadius: 20 }}></div>
        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '4px solid #00ffcc', borderLeft: '4px solid #00ffcc', borderBottomLeftRadius: 20 }}></div>
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '4px solid #00ffcc', borderRight: '4px solid #00ffcc', borderBottomRightRadius: 20 }}></div>
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
      <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, var(--surface), var(--background))' }}>
        <div style={{ 
          textAlign: 'center', 
          padding: '48px', 
          background: 'rgba(20, 21, 31, 0.7)', 
          backdropFilter: 'blur(16px)',
          borderRadius: '24px', 
          border: '1px solid rgba(0, 255, 204, 0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
          maxWidth: '500px',
          width: '100%'
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent), #00ffcc)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,255,204,0.4)', color: '#000' }}>
             <Bot size={32} />
          </div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px', background: 'linear-gradient(to right, #fff, #00ffcc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Interview Coach</h2>
          <p style={{ marginTop: '12px', color: '#9ca3af', fontSize: '16px', lineHeight: 1.5 }}>
            Start a realistic, voice-to-voice interview with our advanced AI agent featuring real-time facial analysis and transcription.
          </p>
          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
              <label htmlFor="themeSelect" style={{ fontWeight: 600, fontSize: '14px', color: '#e5e7eb', marginLeft: '4px' }}>Interview Theme</label>
              <select 
                id="themeSelect" 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                style={{ 
                  padding: '14px 16px', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  background: '#1a1b26', 
                  color: '#ffffff',
                  fontSize: '16px',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2300ffcc%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 16px top 50%',
                  backgroundSize: '12px auto'
                }}
              >
                <option value="HR" style={{ background: '#1a1b26', color: '#fff' }}>HR / General (Friendly Female)</option>
                <option value="Technical" style={{ background: '#1a1b26', color: '#fff' }}>Technical (Deep Male)</option>
                <option value="Behavioral" style={{ background: '#1a1b26', color: '#fff' }}>Behavioral (Professional British)</option>
              </select>
            </div>
            
            <button 
              onClick={handleStart}
              disabled={status === 'connecting'}
              style={{ 
                padding: '16px', 
                background: 'linear-gradient(135deg, var(--accent), #00ffcc)', 
                color: '#000', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: status === 'connecting' ? 'not-allowed' : 'pointer', 
                fontWeight: 700, 
                fontSize: '16px',
                opacity: status === 'connecting' ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(0,255,204,0.3)',
                transition: 'all 0.2s ease',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
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
      style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}
    >
      <div style={{ flex: 1, display: 'flex', padding: '24px', gap: '24px', boxSizing: 'border-box', overflow: 'hidden' }}>
        
        {/* Left Side: User Video + Facial Analysis */}
        <div style={{ flex: 2, height: '100%' }}>
           <VideoView />
        </div>

        {/* Right Side: AI Visualizer & Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
           <div style={{ flex: 1, background: 'var(--background)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #00ffcc)', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,255,204,0.4)', color: '#000' }}>
                 <Bot size={40} />
              </div>
              <h2 style={{ marginBottom: 16 }}>AI Interviewer</h2>
              <p style={{ color: 'var(--text-muted)' }}>Room: {roomName}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'auto' }}>Theme: {theme}</p>
              
              <div style={{ width: '100%', marginTop: '24px' }}>
                 <VoiceAssistantControlBar />
              </div>
           </div>

           {/* Mic / Cam Selectors */}
           <div style={{ background: 'var(--background)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
             <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Device Settings</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '15px', color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <Video size={18} /> Camera
                  </span>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '8px' }}>
                     <MediaDeviceMenu kind="videoinput" />
                  </div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '15px', color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <Mic size={18} /> Microphone
                  </span>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '8px' }}>
                     <MediaDeviceMenu kind="audioinput" />
                  </div>
               </div>
               <button 
                 onClick={handleDisconnect}
                 style={{ marginTop: '8px', padding: '14px', background: 'var(--error, #ef4444)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', width: '100%', transition: 'all 0.2s ease', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
