import { useState, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  BarVisualizer,
  useVoiceAssistant,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { Loader2, Mic, PhoneOff, Video } from 'lucide-react';
import { Track } from 'livekit-client';
import { useFaceAnalyzer } from '../../hooks/useFaceAnalyzer';

import { useNavigate } from 'react-router-dom';

export default function LiveInterview() {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleStartInterview = async () => {
    setConnecting(true);
    try {
      const roomName = `interview-${user?.id}-${Date.now()}`;
      const res = await apiFetch<{ token: string; url: string }>('/interview/token', {
        method: 'POST',
        body: JSON.stringify({ room_name: roomName }),
      });

      if (res.ok && res.data.token && res.data.url) {
        setToken(res.data.token);
        setUrl(res.data.url);
        setCurrentRoom(roomName);
      } else {
        showToast('error', 'Failed to generate connection token.');
      }
    } catch (err) {
      showToast('error', 'Network error while connecting to LiveKit.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setToken(null);
    setUrl(null);
    if (currentRoom) {
      navigate(`/dashboard/live-interview/report/${currentRoom}`);
    }
  };

  return (
    <div className="live-interview-page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboard-page-header">
        <h1>Live Video Interview</h1>
        <p>Real-time conversational interview with an AI Assistant analyzing expressions</p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {!token ? (
          <div className="settings-card" style={{ textAlign: 'center', maxWidth: 500, width: '100%' }}>
            <Video size={48} style={{ color: 'var(--accent-start)', margin: '0 auto 1rem' }} />
            <h2 style={{ marginBottom: '1rem' }}>Ready for your video interview?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              You are about to start a real-time video interview. Ensure your camera and microphone are connected and you are in a well-lit, quiet environment.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleStartInterview}
              disabled={connecting}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {connecting ? (
                <><Loader2 size={18} className="spin" /><span style={{ marginLeft: 8 }}>Connecting...</span></>
              ) : (
                'Connect to Agent'
              )}
            </button>
          </div>
        ) : (
          <LiveKitRoom
            token={token}
            serverUrl={url!}
            connect={true}
            audio={true}
            video={true}
            onDisconnected={handleDisconnect}
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
            <RoomAudioRenderer />
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
              <AgentVisualizer />
              <LocalVideoAndAnalyzer />
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
              <VoiceAssistantControlBar />
              <button 
                className="btn" 
                onClick={handleDisconnect}
                style={{ marginLeft: '1rem', background: 'var(--error)', color: 'white' }}
              >
                <PhoneOff size={18} />
              </button>
            </div>
          </LiveKitRoom>
        )}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LocalVideoAndAnalyzer() {
  const { localParticipant } = useLocalParticipant();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Our custom hook for facial analysis
  useFaceAnalyzer(videoRef, localParticipant);

  useEffect(() => {
    if (videoRef.current && localParticipant) {
      // Find the camera track
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        pub.track.attach(videoRef.current);
      }

      // Handle cases where the track is added slightly after the component mounts
      const onTrackPublished = (publication: any) => {
        if (publication.source === Track.Source.Camera && publication.track && videoRef.current) {
          publication.track.attach(videoRef.current);
        }
      };

      localParticipant.on('localTrackPublished', onTrackPublished);
      return () => {
        localParticipant.off('localTrackPublished', onTrackPublished);
        if (pub?.track && videoRef.current) {
          pub.track.detach(videoRef.current);
        }
      };
    }
  }, [localParticipant]);

  return (
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
  );
}

function AgentVisualizer() {
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: '2rem', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BarVisualizer
          state={state}
          barCount={7}
          trackRef={audioTrack}
          style={{ width: 300, height: 100 }}
          options={{ minHeight: 10 }}
        />
      </div>
      <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
        {state === 'disconnected' ? 'Agent Offline' : state === 'connecting' || state === 'initializing' ? 'Connecting to Agent...' : 'Agent is active...'}
      </h3>
      <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Status: {state}</p>
    </div>
  );
}
