'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth, type AuthUser } from '../context/AuthContext';
import { LoginView } from './LoginView';

function BuilderLoginGate() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user?.role === 'builder') {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (user?.role === 'builder') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-700 shadow-sm">
          در حال انتقال به داشبورد...
        </div>
      </div>
    );
  }

  return (
    <LoginView
      portal="builder"
      onLoginSuccess={() => router.replace('/dashboard')}
    />
  );
}

export function BuilderLoginPage({
  initialUser = null,
}: {
  initialUser?: AuthUser | null;
}) {
  return (
    <AuthProvider initialUser={initialUser} initialResolved={true}>
      <BuilderLoginGate />
    </AuthProvider>
  );
}
