'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface AuthUser {
  role: 'superadmin' | 'builder';
  userId: number;
  username: string;
  displayName: string;
}

export type LoginPortal = 'builder' | 'superadmin';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authError: string | null;
  getAuthHeaders: () => Record<string, string>;
  loginWithCredentials: (
    username: string,
    password: string,
    portal?: LoginPortal
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
  initialResolved?: boolean;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialResolved = false,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialResolved);
  const [authError, setAuthError] = useState<string | null>(null);
  // Keep optional Bearer token strictly in memory (never localStorage/sessionStorage)
  const tokenRef = useRef<string | null>(null);
  const authEpochRef = useRef<number>(0);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = tokenRef.current;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    let cancelled = false;
    const startEpoch = authEpochRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
      headers: getAuthHeaders(),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled || authEpochRef.current !== startEpoch) return;
        if (res.ok && data?.user) {
          if (typeof data.token === 'string' && data.token) {
            tokenRef.current = data.token;
          }
          setUser(data.user as AuthUser);
        } else if (res.ok || res.status === 401) {
          tokenRef.current = null;
          setUser(null);
          if (data?.error) {
            setAuthError(data.error);
          }
        } else if (data?.error) {
          setAuthError(data.error);
        }
      })
      .catch(() => {
        if (
          !cancelled &&
          authEpochRef.current === startEpoch &&
          !initialResolved
        ) {
          tokenRef.current = null;
          setUser(null);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [initialResolved, getAuthHeaders]);

  const loginWithCredentials = useCallback(
    async (
      username: string,
      password: string,
      portal: LoginPortal = 'builder'
    ): Promise<boolean> => {
      setAuthError(null);
      authEpochRef.current += 1;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, portal }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.user) {
          setAuthError(data?.error || 'ورود به سامانه انجام نشد.');
          return false;
        }
        authEpochRef.current += 1;
        tokenRef.current =
          typeof data.token === 'string' && data.token ? data.token : null;
        setUser(data.user as AuthUser);
        return true;
      } catch {
        setAuthError('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    authEpochRef.current += 1;
    const headers = getAuthHeaders();
    tokenRef.current = null;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } finally {
      setUser(null);
    }
  }, [getAuthHeaders]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        getAuthHeaders,
        loginWithCredentials,
        logout,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
