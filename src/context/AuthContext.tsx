import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (error) => {
        console.error('Auth state listener error:', error);
        setAuthError('بررسی وضعیت ورود با خطا مواجه شد.');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      setAuthError(
        'ورود با حساب گوگل انجام نشد. لطفاً مسدودکنندهٔ پنجره‌های بازشو را بررسی کرده و دوباره تلاش کنید.'
      );
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthError('خروج از حساب با خطا مواجه شد.');
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        signInWithGoogle,
        signOutUser,
        getIdToken,
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
