import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '../api/client';

export interface AuthSocketEvent {
  type: string;
  data: Record<string, unknown>;
}

interface UseAuthSocketOpts {
  onEvent?: (event: AuthSocketEvent) => void;
}

/**
 * Manages a WebSocket connection for realtime auth events (OTP sent/verified,
 * login success, session expiry). Generates a persistent per-tab session id
 * and auto-reconnects with exponential backoff on disconnect.
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

    const ws = new WebSocket(getWsUrl(`/ws/auth/${sessionId}`));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
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
