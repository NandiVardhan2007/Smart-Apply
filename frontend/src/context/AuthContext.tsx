import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { configureClient } from '../api/client';
import { useAuthSocket, type AuthSocketEvent } from '../hooks/useAuthSocket';

interface User {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  profile_pic_url?: string | null;
  bio?: string | null;
  skills?: string[];
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  education?: string[];
  experience?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  sessionId: string;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  lastAuthEvent: AuthSocketEvent | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('sa_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('sa_token')
  );
  const [lastAuthEvent, setLastAuthEvent] = useState<AuthSocketEvent | null>(null);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('sa_token', newToken);
    localStorage.setItem('sa_user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_user');
  }, []);

  const handleAuthEvent = useCallback((event: AuthSocketEvent) => {
    setLastAuthEvent(event);

    switch (event.type) {
      case 'otp_verified':
      case 'login_success': {
        const data = event.data;
        if (data.token) {
          const u: User = {
            id: (data.id as string) || '',
            email: (data.email as string) || '',
            full_name: (data.full_name as string) || '',
            is_verified: true,
            profile_pic_url: null,
          };
          setToken(data.token as string);
          setUser(u);
          localStorage.setItem('sa_token', data.token as string);
          localStorage.setItem('sa_user', JSON.stringify(u));
        }
        break;
      }
      case 'session_expired':
        logout();
        break;
    }
  }, [logout]);

  const { sessionId } = useAuthSocket({ onEvent: handleAuthEvent });

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('sa_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Wire up the API client
  useEffect(() => {
    configureClient({
      getToken: () => token,
      getSessionId: () => sessionId,
      onUnauthorized: logout,
    });
  }, [token, sessionId, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        sessionId,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        updateUser,
        lastAuthEvent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
