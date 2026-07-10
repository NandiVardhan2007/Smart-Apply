import { useState, useEffect } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar, MediaDeviceMenu, ParticipantTile, useLocalParticipant, useRoomContext, useDataChannel, VideoTrack } from '@livekit/components-react';
import '@livekit/components-styles';
import { RoomEvent, Track } from 'livekit-client';
import type { TranscriptionSegment, Participant, TrackPublication } from 'livekit-client';

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
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '12px',
          marginBottom: '8px',
          fontSize: '20px',
          fontWeight: 500,
          backdropFilter: 'blur(4px)',
          display: 'inline-block',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          maxWidth: '100%',
          wordWrap: 'break-word'
        }}>
          {seg.text}
        </div>
      ))}
    </div>
  );
}

function FacialAnalysisHUD() {
  const [focus, setFocus] = useState(85);
  const [expression, setExpression] = useState('Analyzing...');
  const [posture, setPosture] = useState('Tracking...');

  // Listen to the backend's NVIDIA Vision Data Channel
  const handleData = (msg: any) => {
    try {
      const dataStr = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(dataStr);
      if (data.focus !== undefined) setFocus(data.focus);
      if (data.expression !== undefined) setExpression(data.expression);
      if (data.posture !== undefined) setPosture(data.posture);
    } catch (e) {
      console.error('Failed to parse facial analysis payload', e);
    }
  };

  useDataChannel('facial_analysis', handleData);

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
        NVIDIA VISION ACTIVE
      </h3>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#aaa' }}>FOCUS LEVEL</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{typeof focus === 'number' ? focus.toFixed(1) : focus}%</div>
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
      
      {/* Cool scanning box overlay */}
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
      <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <h2>AI Voice Interview</h2>
          <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
            Start a realistic voice-to-voice interview with the AI Agent.
          </p>
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label htmlFor="themeSelect" style={{ fontWeight: 500 }}>Select Theme:</label>
              <select 
                id="themeSelect" 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}
              >
                <option value="HR">HR / General (Friendly Female)</option>
                <option value="Technical">Technical (Deep Male)</option>
                <option value="Behavioral">Behavioral (Professional British)</option>
              </select>
            </div>
            
            <button 
              onClick={handleStart}
              disabled={status === 'connecting'}
              style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: status === 'connecting' ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: status === 'connecting' ? 0.7 : 1 }}
            >
              {status === 'connecting' ? 'Connecting...' : 'Start Interview'}
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
           <div style={{ flex: 1, background: 'var(--background)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #00ffcc)', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,255,204,0.4)' }}>
                 <span style={{ fontSize: '32px' }}>🤖</span>
              </div>
              <h2 style={{ marginBottom: 16 }}>AI Interviewer</h2>
              <p style={{ color: 'var(--text-muted)' }}>Room: {roomName}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'auto' }}>Theme: {theme}</p>
              
              <div style={{ width: '100%' }}>
                 <VoiceAssistantControlBar />
              </div>
           </div>

           {/* Mic / Cam Selectors */}
           <div style={{ background: 'var(--background)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
             <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Device Settings</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Camera:</span>
                  <div style={{ background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', padding: '2px 8px' }}>
                     <MediaDeviceMenu kind="videoinput" />
                  </div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Microphone:</span>
                  <div style={{ background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', padding: '2px 8px' }}>
                     <MediaDeviceMenu kind="audioinput" />
                  </div>
               </div>
             </div>
           </div>
        </div>

        <RoomAudioRenderer />
      </div>
    </LiveKitRoom>
  );
}
