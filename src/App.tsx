'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FolderKanban,
  GitCompare,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth, type AuthUser } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import type { AppSection, ExpenseItem, Project } from './types/app';
import { DashboardView } from './components/DashboardView';
import { ExpensesRatesView } from './components/ExpensesRatesView';
import { VersionsView } from './components/VersionsView';
import { CategoriesView } from './components/CategoriesView';
import { ProjectsView } from './components/ProjectsView';
import { ProjectFormModal } from './components/ProjectFormModal';
import { ManualExpenseModal } from './components/ManualExpenseModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { NewVersionModal } from './components/NewVersionModal';

const NAV_ITEMS: Array<{
  id: AppSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'داشبورد و گزارش‌ها', icon: LayoutDashboard },
  { id: 'expenses', label: 'هزینه‌ها و نرخ‌ها', icon: ReceiptText },
  { id: 'versions', label: 'نسخه‌های قیمت‌گذاری', icon: GitCompare },
  { id: 'categories', label: 'دسته‌بندی هزینه‌ها', icon: FolderKanban },
  { id: 'projects', label: 'مدیریت پروژه‌ها', icon: Building2 },
];

function MainWorkspaceShell() {
  const router = useRouter();
  const { user, authError, logout, clearAuthError } = useAuth();
  const {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    projectCategories,
    projectExpenses,
    setSelectedVersionId,
    storageMode,
    storageError,
    clearStorageError,
    createProject,
    updateProject,
    addExpenses,
    updateExpense,
  } = useWorkspace();

  const [section, setSection] = useState<AppSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(
    null
  );

  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [newVersionModalOpen, setNewVersionModalOpen] = useState(false);

  const handleNavClick = (target: AppSection) => {
    setSection(target);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* RTL Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-68 flex-col border-l border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="text-base font-extrabold text-slate-900 whitespace-nowrap">
            سامانه برآورد ساخت
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="بستن منو"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active Project Selector */}
        <div className="border-b border-slate-200 p-4">
          <label
            htmlFor="sidebar-project-select"
            className="block text-[11px] font-semibold text-slate-500"
          >
            پروژهٔ فعال
          </label>
          <select
            id="sidebar-project-select"
            value={activeProjectId ?? ''}
            onChange={(e) => {
              if (e.target.value) setActiveProjectId(Number(e.target.value));
            }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-sky-700 focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
              setMobileMenuOpen(false);
            }}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-800 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            ایجاد پروژهٔ جدید
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="منوی اصلی" className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Storage Status & Builder Account */}
        <div className="border-t border-slate-200 p-4 space-y-3 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <HardDrive className="h-3.5 w-3.5 text-slate-600" />
              <span>وضعیت ذخیره‌سازی</span>
            </div>
            {storageMode === 'cloud' && (
              <p className="leading-5 text-emerald-800">
                متصل به پایگاه داده؛ همهٔ اطلاعات به‌صورت خودکار ذخیره می‌شوند.
              </p>
            )}
            {storageMode === 'loading' && (
              <p className="leading-5 text-slate-600">
                در حال بارگذاری اطلاعات پروژه...
              </p>
            )}
            {storageMode === 'error' && (
              <p className="leading-5 text-red-700">
                دسترسی به پایگاه داده با خطا روبه‌رو شد.
              </p>
            )}
          </div>

          {user && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">
                  {user.displayName}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  حساب سازنده ({user.username})
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.replace('/');
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                خروج
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منوی ناوبری"
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 truncate text-sm font-bold text-slate-900">
              {activeProject ? activeProject.name : 'سامانه برآورد ساخت'}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setManualModalOpen(true);
              }}
              disabled={!activeProject}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              ثبت هزینه
            </button>
          </div>
        </header>

        {(storageError || authError) && (
          <div className="mx-4 mt-4 space-y-2 sm:mx-6">
            {storageError && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900">
                <span>{storageError}</span>
                <button
                  type="button"
                  onClick={clearStorageError}
                  className="font-semibold underline whitespace-nowrap"
                >
                  بستن
                </button>
              </div>
            )}
            {authError && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
                <span>{authError}</span>
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="font-semibold underline whitespace-nowrap"
                >
                  بستن
                </button>
              </div>
            )}
          </div>
        )}

        <main className="mx-auto w-full max-w-[1320px] flex-1 p-4 sm:p-6">
          {section === 'dashboard' && (
            <DashboardView
              onNavigate={setSection}
              onOpenEditProject={() => {
                if (!activeProject) return;
                setEditingProject(activeProject);
                setProjectModalOpen(true);
              }}
              onOpenNewVersion={() => setNewVersionModalOpen(true)}
            />
          )}

          {section === 'expenses' && (
            <ExpensesRatesView
              onOpenManualAdd={() => {
                setEditingExpense(null);
                setManualModalOpen(true);
              }}
              onOpenManualEdit={(exp) => {
                setEditingExpense(exp);
                setManualModalOpen(true);
              }}
              onOpenExcelImport={() => setExcelModalOpen(true)}
              onOpenNewVersion={() => setNewVersionModalOpen(true)}
            />
          )}

          {section === 'versions' && (
            <VersionsView
              onOpenNewVersion={() => setNewVersionModalOpen(true)}
              onInspectInLedger={(versionId) => {
                setSelectedVersionId(versionId);
                setSection('expenses');
              }}
            />
          )}

          {section === 'categories' && <CategoriesView />}

          {section === 'projects' && (
            <ProjectsView
              onOpenNewProject={() => {
                setEditingProject(null);
                setProjectModalOpen(true);
              }}
              onOpenEditProject={(proj) => {
                setEditingProject(proj);
                setProjectModalOpen(true);
              }}
              onSelectAndOpenDashboard={(id) => {
                setActiveProjectId(id);
                setSection('dashboard');
              }}
            />
          )}
        </main>
      </div>

      <ProjectFormModal
        open={projectModalOpen}
        initialProject={editingProject}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSave={async (data) => {
          if (editingProject) {
            return updateProject(editingProject.id, data);
          }
          return createProject(data);
        }}
      />

      <ManualExpenseModal
        open={manualModalOpen}
        categories={projectCategories}
        currency={activeProject?.currency ?? 'تعیین‌نشده'}
        initialExpense={editingExpense}
        onClose={() => {
          setManualModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={async (data) => {
          if (editingExpense) {
            const matchedCat = projectCategories.find(
              (c) => c.name === data.categoryName
            );
            return updateExpense(editingExpense.id, {
              ...data,
              categoryId: matchedCat?.id ?? null,
            });
          }
          return addExpenses([{ ...data, source: 'دستی' }], 'append');
        }}
      />

      <ExcelImportModal
        open={excelModalOpen}
        existingCount={projectExpenses.length}
        currency={activeProject?.currency ?? 'تعیین‌نشده'}
        onClose={() => setExcelModalOpen(false)}
        onImport={async (items, mode) => addExpenses(items, mode)}
      />

      <NewVersionModal
        open={newVersionModalOpen}
        onClose={() => setNewVersionModalOpen(false)}
      />
    </div>
  );
}

function BuilderDashboardGate() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'builder')) {
      router.replace('/');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-700 shadow-sm">
          در حال بررسی وضعیت نشست کاربری...
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'builder') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-700 shadow-sm">
          در حال انتقال به صفحه ورود...
        </div>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <MainWorkspaceShell />
    </WorkspaceProvider>
  );
}

export function BuilderDashboardApp({
  initialUser = null,
}: {
  initialUser?: AuthUser | null;
}) {
  return (
    <AuthProvider
      initialUser={initialUser}
      initialResolved={Boolean(initialUser)}
    >
      <BuilderDashboardGate />
    </AuthProvider>
  );
}

export default BuilderDashboardApp;
