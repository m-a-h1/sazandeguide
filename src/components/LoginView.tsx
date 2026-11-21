'use client';

import React, { useState } from 'react';
import {
  Building2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth, type LoginPortal } from '../context/AuthContext';

interface LoginViewProps {
  portal?: LoginPortal;
  onLoginSuccess?: () => void;
}

export function LoginView({
  portal = 'builder',
  onLoginSuccess,
}: LoginViewProps) {
  const { authError, loginWithCredentials, clearAuthError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isSuperAdminPortal = portal === 'superadmin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!username.trim() || !password) {
      setLocalError('لطفاً نام کاربری و رمز عبور خود را وارد کنید.');
      return;
    }

    setSubmitting(true);
    const ok = await loginWithCredentials(username.trim(), password, portal);
    setSubmitting(false);
    if (ok) {
      onLoginSuccess?.();
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
              {isSuperAdminPortal ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">
                {isSuperAdminPortal
                  ? 'پنل مدیریت کل سامانه'
                  : 'سامانه مدیریت هزینه‌های ساخت'}
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {isSuperAdminPortal
                  ? 'ورود مدیر کل برای ایجاد و مدیریت سازندگان'
                  : 'ورود سازندگان و مدیران پروژه'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {displayError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-5 text-red-900"
              >
                {displayError}
              </div>
            )}

            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-slate-700"
              >
                نام کاربری
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="نام کاربری خود را وارد کنید"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-10 pl-3.5 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700"
              >
                رمز عبور
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور خود را وارد کنید"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? 'مخفی‌کردن رمز عبور' : 'نمایش رمز عبور'
                  }
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {submitting
                ? 'در حال بررسی...'
                : isSuperAdminPortal
                  ? 'ورود به پنل مدیریت کل'
                  : 'ورود به داشبورد سازنده'}
            </button>
          </form>

          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-xs leading-5 text-slate-500">
            {isSuperAdminPortal
              ? 'دسترسی ویژه مدیر کل سامانه با نام کاربری و رمز عبور مدیریتی.'
              : 'حساب کاربری سازندگان توسط مدیر کل سامانه ایجاد و مدیریت می‌شود.'}
          </p>
        </div>
      </div>
    </div>
  );
}
