import { useEffect, useRef, useState, useCallback } from 'react';

export interface AuthSocketEvent {
  type: string;
  data: Record<string, unknown>;
}

interface UseAuthSocketOpts {
  onEvent?: (event: AuthSocketEvent) => void;
}

/**
 * Custom hook that manages a WebSocket connection for real-time auth events.
 * Generates a persistent session ID and auto-reconnects on disconnect.
 */
export function useAuthSocket(opts?: UseAuthSocketOpts) {
  const [sessionId] = useState<string>(() => {
    const stored = sessionStorage.getItem('sa_session_id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem('sa_session_id', id);
    return id;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectDelay = useRef(1000);
  const mountedRef = useRef(true);
  const onEventRef = useRef(opts?.onEvent);
  onEventRef.current = opts?.onEvent;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    let url = '';
    if (apiBaseUrl.startsWith('http')) {
      url = apiBaseUrl.replace(/^http/, 'ws') + `/ws/auth/${sessionId}`;
    } else {
      url = `${wsProto}//${window.location.host}${apiBaseUrl}/ws/auth/${sessionId}`;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000; // Reset backoff
    };

    ws.onmessage = (e) => {
      try {
        const event: AuthSocketEvent = JSON.parse(e.data);
        onEventRef.current?.(event);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Exponential backoff reconnect
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { sessionId };
}
