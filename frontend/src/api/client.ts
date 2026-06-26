/**
 * API client — reusable fetch wrapper with auth and session headers.
 */

let _getToken: (() => string | null) | null = null;
let _getSessionId: (() => string | null) | null = null;
let _onUnauthorized: (() => void) | null = null;

/** Called by AuthContext to wire up token/session getters */
export function configureClient(opts: {
  getToken: () => string | null;
  getSessionId: () => string | null;
  onUnauthorized: () => void;
}) {
  _getToken = opts.getToken;
  _getSessionId = opts.getSessionId;
  _onUnauthorized = opts.onUnauthorized;
}

interface ApiResponse<T = unknown> {
  data: T;
  ok: boolean;
  status: number;
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Attach auth token
  const token = _getToken?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach session ID for WebSocket routing
  const sessionId = _getSessionId?.();
  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
  }

  // Set content type for JSON bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    _onUnauthorized?.();
  }

  let data: T;
  try {
    data = await response.json();
  } catch {
    data = {} as T;
  }

  return { data, ok: response.ok, status: response.status };
}
