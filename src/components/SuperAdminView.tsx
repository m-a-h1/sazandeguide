'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Edit3,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatJalaliDisplay, gregorianToJalali } from '../utils/jalali';
import { formatNumberFa } from '../utils/pricing';
import { ConfirmModal } from './ConfirmModal';

interface BuilderRecord {
  id: number;
  displayName: string;
  username: string;
  isActive: boolean;
  projectCount: number;
  createdAt: string;
}

function formatCreatedAtJalali(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const jalali = gregorianToJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  return formatJalaliDisplay(jalali);
}

export function SuperAdminView() {
  const { user, logout, getAuthHeaders } = useAuth();
  const [builders, setBuilders] = useState<BuilderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create builder form modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit builder modal
  const [editingBuilder, setEditingBuilder] = useState<BuilderRecord | null>(
    null
  );
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [builderToDelete, setBuilderToDelete] = useState<BuilderRecord | null>(
    null
  );

  const loadBuilders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/builders', {
        credentials: 'include',
        cache: 'no-store',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'خطا در دریافت فهرست سازندگان.');
      }
      setBuilders(Array.isArray(data.builders) ? data.builders : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'خطا در ارتباط با پایگاه داده.'
      );
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    loadBuilders();
  }, [loadBuilders]);

  const stats = useMemo(() => {
    const totalBuilders = builders.length;
    const activeBuilders = builders.filter((b) => b.isActive).length;
    const totalProjects = builders.reduce(
      (sum, b) => sum + (b.projectCount ?? 0),
      0
    );
    return { totalBuilders, activeBuilders, totalProjects };
  }, [builders]);

  const filteredBuilders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return builders;
    return builders.filter(
      (b) =>
        b.displayName.toLowerCase().includes(q) ||
        b.username.toLowerCase().includes(q)
    );
  }, [builders, search]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (createName.trim().length < 2) {
      setCreateError('نام سازنده باید حداقل ۲ کاراکتر باشد.');
      return;
    }
    if (createUsername.trim().length < 3 || /\s/.test(createUsername.trim())) {
      setCreateError('نام کاربری باید حداقل ۳ کاراکتر و بدون فاصله باشد.');
      return;
    }
    if (createPassword.length < 6) {
      setCreateError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/builders', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: createName.trim(),
          username: createUsername.trim(),
          password: createPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.builder) {
        setCreateError(data?.error || 'ایجاد حساب سازنده انجام نشد.');
        setCreating(false);
        return;
      }

      setBuilders((prev) => [data.builder as BuilderRecord, ...prev]);
      setCreateName('');
      setCreateUsername('');
      setCreatePassword('');
      setCreateOpen(false);
    } catch {
      setCreateError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (builder: BuilderRecord) => {
    setEditingBuilder(builder);
    setEditName(builder.displayName);
    setEditPassword('');
    setShowEditPassword(false);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuilder) return;
    setEditError(null);

    if (editName.trim().length < 2) {
      setEditError('نام سازنده باید حداقل ۲ کاراکتر باشد.');
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setEditError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/builders/${editingBuilder.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: editName.trim(),
          ...(editPassword ? { password: editPassword } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.builder) {
        setEditError(data?.error || 'ویرایش حساب سازنده انجام نشد.');
        setSavingEdit(false);
        return;
      }

      setBuilders((prev) =>
        prev.map((b) =>
          b.id === editingBuilder.id ? (data.builder as BuilderRecord) : b
        )
      );
      setEditingBuilder(null);
    } catch {
      setEditError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (builder: BuilderRecord) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/builders/${builder.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ isActive: !builder.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.builder) {
        setError(data?.error || 'تغییر وضعیت سازنده انجام نشد.');
        return;
      }
      setBuilders((prev) =>
        prev.map((b) =>
          b.id === builder.id ? (data.builder as BuilderRecord) : b
        )
      );
    } catch {
      setError('خطا در تغییر وضعیت سازنده.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!builderToDelete) return;
    const targetId = builderToDelete.id;
    setBuilderToDelete(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/builders/${targetId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'حذف سازنده انجام نشد.');
        return;
      }
      setBuilders((prev) => prev.filter((b) => b.id !== targetId));
    } catch {
      setError('خطا در حذف سازنده.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900">
                پنل مدیر کل سامانه
              </h1>
              <p className="text-xs text-slate-500">
                تعریف و مدیریت حساب کاربری سازندگان ({user?.displayName || 'مدیر کل'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4" />
              ایجاد سازنده جدید
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] space-y-6 p-4 sm:p-6">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-semibold underline whitespace-nowrap"
            >
              بستن
            </button>
          </div>
        )}

        {/* KPI Summary */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">
              تعداد کل سازندگان
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
              {formatNumberFa(stats.totalBuilders)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">
              سازندگان فعال
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-700 tabular-nums">
              {formatNumberFa(stats.activeBuilders)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">
              مجموع پروژه‌های ثبت‌شده
            </div>
            <div className="mt-2 text-2xl font-extrabold text-sky-900 tabular-nums">
              {formatNumberFa(stats.totalProjects)}
            </div>
          </div>
        </section>

        {/* Builders List */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                فهرست سازندگان
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                هر سازنده با نام کاربری و رمز عبور اختصاصی وارد فضای کاری مجزای خود می‌شود.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجو در نام یا نام کاربری..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pr-9 pl-3 text-xs text-slate-900 focus:border-sky-700 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              در حال بارگذاری فهرست سازندگان...
            </div>
          ) : filteredBuilders.length === 0 ? (
            <div className="p-10 text-center">
              <Building2 className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {builders.length === 0
                  ? 'هنوز هیچ سازنده‌ای ثبت نشده است'
                  : 'سازنده‌ای با این مشخصات یافت نشد'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {builders.length === 0
                  ? 'برای شروع، اولین حساب سازنده را با نام، نام کاربری و رمز عبور ایجاد کنید.'
                  : 'عبارت جست‌وجو را تغییر دهید.'}
              </p>
              {builders.length === 0 && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  ایجاد اولین سازنده
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">نام سازنده</th>
                    <th className="px-5 py-3.5">نام کاربری</th>
                    <th className="px-5 py-3.5">تعداد پروژه‌ها</th>
                    <th className="px-5 py-3.5">تاریخ ایجاد</th>
                    <th className="px-5 py-3.5">وضعیت</th>
                    <th className="px-5 py-3.5 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBuilders.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {b.displayName}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                        {b.username}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 tabular-nums">
                        {formatNumberFa(b.projectCount)} پروژه
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 tabular-nums">
                        {formatCreatedAtJalali(b.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                            b.isActive
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            ویرایش
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {b.isActive ? (
                              <>
                                <UserX className="h-3.5 w-3.5 text-amber-700" />
                                غیرفعال‌کردن
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                                فعال‌کردن
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setBuilderToDelete(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Create Builder Modal (only 3 fields: Name, Username, Password) */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-builder-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2
                id="create-builder-title"
                className="text-base font-bold text-slate-900"
              >
                ایجاد حساب سازنده جدید
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="بستن"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 p-6">
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900">
                  {createError}
                </div>
              )}

              <div>
                <label
                  htmlFor="builder-create-name"
                  className="block text-sm font-medium text-slate-700"
                >
                  نام سازنده <span className="text-red-600">*</span>
                </label>
                <input
                  id="builder-create-name"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="مثال: مهندس رضایی"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="builder-create-username"
                  className="block text-sm font-medium text-slate-700"
                >
                  نام کاربری <span className="text-red-600">*</span>
                </label>
                <input
                  id="builder-create-username"
                  type="text"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  placeholder="حداقل ۳ کاراکتر بدون فاصله"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="builder-create-password"
                  className="block text-sm font-medium text-slate-700"
                >
                  رمز عبور <span className="text-red-600">*</span>
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="builder-create-password"
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 pl-10 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((p) => !p)}
                    aria-label={
                      showCreatePassword ? 'مخفی‌کردن رمز' : 'نمایش رمز'
                    }
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showCreatePassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {creating ? 'در حال ثبت...' : 'ایجاد سازنده'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Builder Modal */}
      {editingBuilder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-builder-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2
                id="edit-builder-title"
                className="text-base font-bold text-slate-900"
              >
                ویرایش حساب سازنده
              </h2>
              <button
                type="button"
                onClick={() => setEditingBuilder(null)}
                aria-label="بستن"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 p-6">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900">
                  {editError}
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500">
                  نام کاربری:{' '}
                  <span className="font-mono font-semibold text-slate-800">
                    {editingBuilder.username}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="builder-edit-name"
                  className="block text-sm font-medium text-slate-700"
                >
                  نام سازنده <span className="text-red-600">*</span>
                </label>
                <input
                  id="builder-edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="builder-edit-password"
                  className="block text-sm font-medium text-slate-700"
                >
                  رمز عبور جدید (اختیاری)
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="builder-edit-password"
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="در صورت خالی‌بودن، رمز قبلی حفظ می‌شود"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 pl-10 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((p) => !p)}
                    aria-label={
                      showEditPassword ? 'مخفی‌کردن رمز' : 'نمایش رمز'
                    }
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBuilder(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingEdit ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Builder */}
      <ConfirmModal
        open={Boolean(builderToDelete)}
        title="حذف حساب سازنده"
        description={
          builderToDelete
            ? `آیا از حذف حساب «${builderToDelete.displayName}» اطمینان دارید؟ تمام پروژه‌ها، هزینه‌ها و نسخه‌های قیمت‌گذاری ثبت‌شدهٔ این سازنده نیز حذف خواهند شد.`
            : ''
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setBuilderToDelete(null)}
      />
    </div>
  );
}
