import { useState, useCallback } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar, useLocalParticipant } from '@livekit/components-react';
import '@livekit/components-styles';

import { apiFetch } from '../../api/client';
import { useToast } from '../../components/Toast';

export default function LiveKitInterview() {
  const [token, setToken] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const { showToast } = useToast();

  const handleStart = async () => {
    setStatus('connecting');
    try {
      const res = await apiFetch<{token: string, room_name: string}>('/livekit/token');
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

  if (status === 'idle') {
    return (
      <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <h2>AI Voice Interview</h2>
          <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
            Start a realistic voice-to-voice interview with the AI Agent.
          </p>
          <button 
            onClick={handleStart}
            style={{ marginTop: '24px', padding: '12px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      connect={true}
      onDisconnected={handleDisconnect}
      style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: 16 }}>Interview in Progress</h2>
        <p style={{ color: 'var(--text-muted)' }}>Room: {roomName}</p>
        
        {/* Render the agent's audio stream */}
        <RoomAudioRenderer />
      </div>

      {/* Renders the mute/unmute controls and the nice voice visualizer */}
      <div style={{ padding: '24px', borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
         <VoiceAssistantControlBar />
      </div>
    </LiveKitRoom>
  );
}
