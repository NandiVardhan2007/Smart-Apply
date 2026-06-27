/**
 * API client — reusable fetch wrapper with auth and session headers.
 *
 * FIX: configureClient was previously called inside a useEffect in AuthContext,
 * meaning child component effects (Profile, Resumes, etc.) fired BEFORE
 * _getToken was wired up — causing every first-visit to a dashboard page to
 * send requests with no Authorization header, returning empty/401 responses.
 *
 * The fix is two-part:
 *  1. apiFetch falls back to reading directly from localStorage when _getToken
 *     is not yet set, so the token is never missing on first mount.
 *  2. AuthContext calls configureClient() synchronously during render (not in
 *     a useEffect), so _getToken is always set before any child renders or fires
 *     their own effects.
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

  // Attach auth token — fall back to localStorage if configureClient hasn't
  // been called yet (can happen on very first render before AuthContext effect fires)
  const token = _getToken ? _getToken() : localStorage.getItem('sa_token');
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

  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const response = await fetch(`${baseUrl}${endpoint}`, {
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
