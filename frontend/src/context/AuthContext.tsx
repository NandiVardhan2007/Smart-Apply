import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { configureClient, apiFetch } from '../api/client';
import { useAuthSocket, type AuthSocketEvent } from '../hooks/useAuthSocket';
import type { User } from '../api/types';
import { auth, onAuthStateChanged, signOut } from '../lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  sessionId: string;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  lastAuthEvent: AuthSocketEvent | null;
  login: (token: string, user: User) => void; // Keep this just in case, though it may not be used
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastAuthEvent, setLastAuthEvent] = useState<AuthSocketEvent | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        try {
          const token = await fUser.getIdToken();
          const res = await apiFetch('/auth/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            setUser(res.data as User);
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    // This is essentially a no-op now, because Firebase handles login.
    // However, to satisfy TypeScript / any old callers, we can leave it.
  }, []);

  const logout = useCallback(async () => {
    try {
      sessionStorage.setItem('sa_logging_out', '1');
    } catch {}
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
    apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    if (typeof window !== 'undefined' && window.location.pathname !== '/' && window.location.pathname !== '/landing') {
      window.location.replace('/');
    }
  }, []);

  const handleAuthEvent = useCallback(
    (event: AuthSocketEvent) => {
      setLastAuthEvent(event);

      switch (event.type) {
        case 'session_expired':
          logout();
          break;
      }
    },
    [logout]
  );

  const { sessionId } = useAuthSocket({ onEvent: handleAuthEvent });

  const sessionIdRef = useRef(sessionId);
  const logoutRef = useRef(logout);
  sessionIdRef.current = sessionId;
  logoutRef.current = logout;

  configureClient({
    getSessionId: () => sessionIdRef.current,
    onUnauthorized: () => logoutRef.current(),
  });

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        sessionId,
        isAuthenticated: Boolean(user),
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
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
