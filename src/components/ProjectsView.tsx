'use client';

import React, { useState } from 'react';
import { Building2, Check, ClipboardList, Edit3, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { Project } from '../types/app';
import { formatJalaliDisplay } from '../utils/jalali';
import {
  formatCurrencyValue,
  formatNumberFa,
  formatPercentFa,
} from '../utils/pricing';
import { ConfirmModal } from './ConfirmModal';

interface ProjectsViewProps {
  onOpenNewProject: () => void;
  onOpenEditProject: (project: Project) => void;
  onSelectAndOpenDashboard: (projectId: number) => void;
  onSelectAndOpenDetailed: (projectId: number) => void;
}

export function ProjectsView({
  onOpenNewProject,
  onOpenEditProject,
  onSelectAndOpenDashboard,
  onSelectAndOpenDetailed,
}: ProjectsViewProps) {
  const { projects, activeProjectId, deleteProject } = useWorkspace();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            مدیریت پروژه‌های ساختمانی
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            اطلاعات، واحد پول، هزینه‌های پایه و نسخه‌های قیمت‌گذاری هر پروژه کاملاً مستقل از پروژه‌های دیگر نگهداری می‌شود.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewProject}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          تعریف پروژهٔ جدید
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {projects.map((proj) => {
          const isActive = proj.id === activeProjectId;
          return (
            <div
              key={proj.id}
              className={`rounded-xl border bg-white p-5 transition-colors ${
                isActive ? 'border-sky-700 ring-1 ring-sky-700/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{proj.status}</span>
                    <span aria-hidden="true">·</span>
                    <span>واحد پول: {proj.currency}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      مالیات: {formatPercentFa(proj.taxPercent ?? 0)}
                    </span>
                    {isActive && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-sky-800">
                          پروژهٔ فعال
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-1 text-base font-bold text-slate-900">
                    {proj.name}
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenEditProject(proj)}
                    aria-label={`ویرایش پروژه ${proj.name}`}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setProjectToDelete(proj)}
                      aria-label={`حذف پروژه ${proj.name}`}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {proj.address && (
                <p className="mt-2 text-xs text-slate-600">{proj.address}</p>
              )}
              {proj.description && (
                <p className="mt-1.5 text-xs leading-5 text-slate-500 line-clamp-2">
                  {proj.description}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600 tabular-nums sm:grid-cols-3 lg:grid-cols-7">
                <div>
                  <span className="block text-[11px] text-slate-400">زیربنای کل</span>
                  <span className="font-semibold text-slate-800">
                    {proj.areaSqm ? `${formatNumberFa(proj.areaSqm)} مترمربع` : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">زیربنای مفید</span>
                  <span className="font-semibold text-slate-800">
                    {proj.usefulAreaSqm
                      ? `${formatNumberFa(proj.usefulAreaSqm)} مترمربع`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">قیمت زمین</span>
                  <span className="font-semibold text-slate-800">
                    {proj.landPrice > 0
                      ? formatCurrencyValue(proj.landPrice, proj.currency)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">درصد مشارکت</span>
                  <span className="font-semibold text-slate-800">
                    {proj.partnershipPercent !== null &&
                    proj.partnershipPercent !== undefined
                      ? formatPercentFa(proj.partnershipPercent)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">طبقات / واحد</span>
                  <span className="font-semibold text-slate-800">
                    {proj.floors !== null ? formatNumberFa(proj.floors) : '—'} /{' '}
                    {proj.units !== null ? formatNumberFa(proj.units) : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">تاریخ شروع</span>
                  <span className="font-semibold text-slate-800">
                    {formatJalaliDisplay(proj.startDateJalali)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400">تاریخ پایان</span>
                  <span className="font-semibold text-slate-800">
                    {formatJalaliDisplay(proj.endDateJalali)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onSelectAndOpenDetailed(proj.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  ثبت و گزارش جزئیات
                </button>
                <button
                  type="button"
                  onClick={() => onSelectAndOpenDashboard(proj.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-sky-800 text-white hover:bg-sky-900'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      مشاهدهٔ داشبورد پروژه
                    </>
                  ) : (
                    <>
                      <Building2 className="h-3.5 w-3.5" />
                      انتخاب این پروژه
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={Boolean(projectToDelete)}
        title="تأیید حذف پروژه"
        description={
          projectToDelete
            ? `آیا از حذف کامل پروژهٔ «${projectToDelete.name}» به همراه تمام هزینه‌ها و نسخه‌های قیمت‌گذاری آن مطمئن هستید؟`
            : ''
        }
        confirmLabel="حذف کامل پروژه"
        onCancel={() => setProjectToDelete(null)}
        onConfirm={async () => {
          if (!projectToDelete) return;
          await deleteProject(projectToDelete.id);
          setProjectToDelete(null);
        }}
      />
    </div>
  );
}
