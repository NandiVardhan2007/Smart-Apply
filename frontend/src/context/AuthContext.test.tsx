import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import React from 'react';

vi.mock('../api/client', () => ({
  configureClient: vi.fn(),
  apiFetch: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('../hooks/useAuthSocket', () => ({
  useAuthSocket: () => ({ sessionId: 'test-session-id' }),
}));

vi.mock('../lib/firebase', () => ({
  auth: {},
  onAuthStateChanged: vi.fn((auth, cb) => {
    // Invoke with null immediately for initial unauthenticated state
    cb(null);
    return vi.fn();
  }),
  signOut: vi.fn(),
}));

describe('AuthContext', () => {
  it('provides unauthenticated state initially', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});

