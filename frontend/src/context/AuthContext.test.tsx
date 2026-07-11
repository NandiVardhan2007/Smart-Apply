import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import React from 'react';

vi.mock('../api/client', () => ({
  configureClient: vi.fn(),
  apiFetch: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('../hooks/useAuthSocket', () => ({
  useAuthSocket: () => ({ sessionId: 'test-session-id' }),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('provides unauthenticated state initially when no user is in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('provides authenticated state initially if user is in localStorage', () => {
    localStorage.setItem('sa_user', JSON.stringify({ email: 'test@example.com' }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
  });

  it('updates state on login', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    
    act(() => {
      result.current.login('new-token', { id: '1', email: 'test@example.com', full_name: 'Test', is_verified: true, is_admin: false, profile_pic_url: null, has_onboarded: false });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('new-token');
    expect(JSON.parse(localStorage.getItem('sa_user') || '{}').email).toBe('test@example.com');
  });

  it('clears state on logout', () => {
    localStorage.setItem('sa_user', JSON.stringify({ email: 'test@example.com' }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    
    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('sa_user')).toBeNull();
  });
});
