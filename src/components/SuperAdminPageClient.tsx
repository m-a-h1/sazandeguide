'use client';

import React from 'react';
import { AuthProvider, useAuth, type AuthUser } from '../context/AuthContext';
import { LoginView } from './LoginView';
import { SuperAdminView } from './SuperAdminView';

function SuperAdminGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-700 shadow-sm">
          در حال بررسی وضعیت نشست کاربری...
        </div>
      </div>
    );
  }

  if (user?.role === 'superadmin') {
    return <SuperAdminView />;
  }

  return <LoginView portal="superadmin" />;
}

export function SuperAdminPageClient({
  initialUser = null,
}: {
  initialUser?: AuthUser | null;
}) {
  return (
    <AuthProvider initialUser={initialUser} initialResolved={true}>
      <SuperAdminGate />
    </AuthProvider>
  );
}
