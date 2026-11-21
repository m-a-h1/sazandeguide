import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Calendar,
  Download,
  Edit3,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { PricingVersion } from '../types/app';
import { formatJalaliDisplay, normalizeDigits, parseJalaliDate } from '../utils/jalali';
import {
  formatCurrencyValue,
  formatNumberFa,
  formatPercentFa,
} from '../utils/pricing';
import { createProjectExportWorkbook } from '../utils/excelParser';
import { ConfirmModal } from './ConfirmModal';

interface VersionsViewProps {
  onOpenNewVersion: () => void;
  onInspectInLedger: (versionId: number) => void;
}

export function VersionsView({
  onOpenNewVersion,
  onInspectInLedger,
}: VersionsViewProps) {
  const {
    activeProject,
    projectExpenses,
    projectVersions,
    draftValuation,
    updatePricingVersionMeta,
    deletePricingVersion,
  } = useWorkspace();

  const [detailVersion, setDetailVersion] = useState<PricingVersion | null>(null);
  const [compareLeft, setCompareLeft] = useState<string>('BASE');
  const [compareRight, setCompareRight] = useState<string>(
    projectVersions[0] ? String(projectVersions[0].id) : 'DRAFT'
  );

  // Explicit confirmation states for editing/deleting saved versions
  const [editingVersion, setEditingVersion] = useState<PricingVersion | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);

  const [versionToDelete, setVersionToDelete] = useState<PricingVersion | null>(
    null
  );

  const resolvedRightId = useMemo(() => {
    if (
      compareRight !== 'BASE' &&
      compareRight !== 'DRAFT' &&
      !projectVersions.some((v) => String(v.id) === compareRight)
    ) {
      return projectVersions[0] ? String(projectVersions[0].id) : 'DRAFT';
    }
    return compareRight;
  }, [compareRight, projectVersions]);

  const comparisonData = useMemo(() => {
    if (!activeProject) return null;

    const getSnapshotMap = (key: string) => {
      if (key === 'BASE') {
        return {
          label: 'قیمت پایه (مرجع ثابت)',
          total: draftValuation.totalBaseAmount,
          items: new Map(
            draftValuation.items.map((i) => [
              i.expenseId,
              { title: i.title, categoryName: i.categoryName, amount: i.baseAmount },
            ])
          ),
        };
      }
      if (key === 'DRAFT') {
        return {
          label: 'پیش‌نویس کاری فعلی',
          total: draftValuation.totalEstimatedAmount,
          items: new Map(
            draftValuation.items.map((i) => [
              i.expenseId,
              {
                title: i.title,
                categoryName: i.categoryName,
                amount: i.estimatedAmount,
              },
            ])
          ),
        };
      }
      const ver = projectVersions.find((v) => String(v.id) === key);
      if (!ver) return null;
      return {
        label: `${ver.name} (${formatJalaliDisplay(ver.versionDateJalali)})`,
        total: ver.totalEstimatedAmount,
        items: new Map(
          ver.itemsSnapshot.map((i) => [
            i.expenseId,
            {
              title: i.title,
              categoryName: i.categoryName,
              amount: i.estimatedAmount,
            },
          ])
        ),
      };
    };

    const left = getSnapshotMap(compareLeft);
    const right = getSnapshotMap(resolvedRightId);
    if (!left || !right) return null;

    const allIds = new Set<number>([
      ...left.items.keys(),
      ...right.items.keys(),
    ]);
    const rows = Array.from(allIds).map((id) => {
      const l = left.items.get(id);
      const r = right.items.get(id);
      const leftAmt = l?.amount ?? 0;
      const rightAmt = r?.amount ?? 0;
      const diff = rightAmt - leftAmt;
      const pct = leftAmt > 0 ? (diff / leftAmt) * 100 : 0;
      return {
        id,
        title: r?.title ?? l?.title ?? '—',
        categoryName: r?.categoryName ?? l?.categoryName ?? '—',
        leftAmt,
        rightAmt,
        diff,
        pct,
      };
    });

    const totalDiff = right.total - left.total;
    const totalPct = left.total > 0 ? (totalDiff / left.total) * 100 : 0;

    return {
      leftLabel: left.label,
      rightLabel: right.label,
      leftTotal: left.total,
      rightTotal: right.total,
      totalDiff,
      totalPct,
      rows,
    };
  }, [
    activeProject,
    compareLeft,
    resolvedRightId,
    draftValuation,
    projectVersions,
  ]);

  if (!activeProject) return null;

  const handleExportVersion = (v: PricingVersion) => {
    const bytes = createProjectExportWorkbook({
      projectName: activeProject.name,
      currency: activeProject.currency,
      versionName: v.name,
      versionDateJalali: v.versionDateJalali,
      taxPercent: v.taxPercentSnapshot ?? 0,
      areaSqm: activeProject.areaSqm,
      usefulAreaSqm: activeProject.usefulAreaSqm,
      landPrice: v.landPriceSnapshot ?? 0,
      partnershipPercent: v.partnershipPercentSnapshot ?? null,
      items: v.itemsSnapshot,
      versions: projectVersions,
      expenses: projectExpenses,
    });
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name}-${v.name}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditMeta = (v: PricingVersion) => {
    setEditingVersion(v);
    setEditName(v.name);
    setEditDate(v.versionDateJalali);
    setEditDesc(v.description);
    setEditError(null);
    setConfirmEditOpen(false);
  };

  const handleRequestSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editName.trim()) {
      setEditError('نام نسخه الزامی است.');
      return;
    }
    const dateCheck = parseJalaliDate(editDate);
    if (!dateCheck.valid) {
      setEditError(dateCheck.error ?? 'تاریخ شمسی نامعتبر است.');
      return;
    }
    setConfirmEditOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            نسخه‌های قیمت‌گذاری و مقایسهٔ برآوردها
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            هر نسخه تصویر ثابتی از نرخ‌ها و مبالغ در تاریخ مشخص است و با تغییر نرخ‌های بعدی تغییر نمی‌کند.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewVersion}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          ثبت نسخهٔ قیمت‌گذاری جدید
        </button>
      </div>

      {/* Saved Versions List */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">
          فهرست نسخه‌های ذخیره‌شده ({formatNumberFa(projectVersions.length)})
        </h2>

        {projectVersions.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              هنوز هیچ نسخهٔ قیمت‌گذاری برای این پروژه ثبت نشده است.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              پس از تنظیم درصد دسته‌ها یا درصدهای مستقل در جدول هزینه‌ها، اولین نسخه را ذخیره کنید.
            </p>
            <button
              type="button"
              onClick={onOpenNewVersion}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              ساخت اولین نسخه
            </button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[820px] text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">نام نسخه</th>
                  <th className="px-3 py-3 font-semibold">تاریخ شمسی</th>
                  <th className="px-3 py-3 font-semibold">مبنای محاسبه</th>
                  <th className="px-3 py-3 font-semibold">جمع پایه</th>
                  <th className="px-3 py-3 font-semibold">جمع برآورد</th>
                  <th className="px-3 py-3 font-semibold">اختلاف با پایه</th>
                  <th className="px-3 py-3 font-semibold text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectVersions.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{v.name}</div>
                      {v.description && (
                        <div className="mt-0.5 text-[11px] text-slate-500 max-w-xs truncate">
                          {v.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatJalaliDisplay(v.versionDateJalali)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {v.baseReferenceType === 'VERSION' && v.parentVersionName
                        ? `نسخهٔ ${v.parentVersionName}`
                        : 'قیمت پایهٔ ثابت'}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-700">
                      {formatCurrencyValue(v.totalBaseAmount, activeProject.currency)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <div className="font-bold text-sky-900">
                        {formatCurrencyValue(
                          v.totalEstimatedAmount,
                          activeProject.currency
                        )}
                      </div>
                      {(v.taxPercentSnapshot ?? 0) > 0 && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          با مالیات ({formatPercentFa(v.taxPercentSnapshot)}):{' '}
                          {formatCurrencyValue(
                            v.totalEstimatedAmount *
                              (1 + v.taxPercentSnapshot / 100),
                            activeProject.currency
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-3 py-3 font-semibold tabular-nums ${
                        v.diffFromBaseAmount > 0
                          ? 'text-red-700'
                          : v.diffFromBaseAmount < 0
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {formatNumberFa(v.diffFromBaseAmount, { showPlus: true })} (
                      {formatPercentFa(v.diffFromBasePercent, { showPlus: true })}
                      )
                    </td>
                    <td className="px-3 py-3 text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailVersion(v)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3 w-3" />
                          جزئیات
                        </button>
                        <button
                          type="button"
                          onClick={() => onInspectInLedger(v.id)}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
                        >
                          جدول اقلام
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportVersion(v)}
                          aria-label={`خروجی اکسل ${v.name}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditMeta(v)}
                          aria-label={`ویرایش مشخصات ${v.name}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setVersionToDelete(v)}
                          aria-label={`حذف نسخه ${v.name}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Version Detail Drawer/Card */}
      {detailVersion && (
        <section className="rounded-xl border border-sky-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                جزئیات نسخه: {detailVersion.name}
              </h3>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                تاریخ: {formatJalaliDisplay(detailVersion.versionDateJalali)}
                <span className="mx-2 text-slate-400">·</span>
                مبنای محاسبه:{' '}
                {detailVersion.baseReferenceType === 'VERSION' &&
                detailVersion.parentVersionName
                  ? `نسخهٔ ${detailVersion.parentVersionName}`
                  : 'قیمت پایهٔ ثابت پروژه'}
                <span className="mx-2 text-slate-400">·</span>
                مالیات نسخه: {formatPercentFa(detailVersion.taxPercentSnapshot ?? 0)}
                {(detailVersion.landPriceSnapshot ?? 0) > 0 && (
                  <>
                    <span className="mx-2 text-slate-400">·</span>
                    قیمت زمین:{' '}
                    {formatCurrencyValue(
                      detailVersion.landPriceSnapshot,
                      activeProject.currency
                    )}
                  </>
                )}
                {detailVersion.partnershipPercentSnapshot !== null &&
                  detailVersion.partnershipPercentSnapshot !== undefined && (
                    <>
                      <span className="mx-2 text-slate-400">·</span>
                      درصد مشارکت:{' '}
                      {formatPercentFa(detailVersion.partnershipPercentSnapshot)}
                    </>
                  )}
              </p>
              {detailVersion.description && (
                <p className="mt-1.5 text-xs text-slate-700">
                  {detailVersion.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDetailVersion(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              بستن جزئیات
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
            {Object.entries(detailVersion.categoryRatesSnapshot).map(
              ([catName, rate]) => (
                <div
                  key={catName}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 tabular-nums"
                >
                  <span className="font-medium text-slate-700">{catName}</span>
                  <span className="font-bold text-slate-900">
                    {formatPercentFa(rate, { showPlus: true })}
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Side-by-Side Comparison */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">
              مقایسهٔ دو نسخه یا مقایسه با قیمت پایه
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label htmlFor="cmp-left" className="font-medium text-slate-600">
                مبنا (الف):
              </label>
              <select
                id="cmp-left"
                value={compareLeft}
                onChange={(e) => setCompareLeft(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
              >
                <option value="BASE">قیمت پایه (مرجع ثابت)</option>
                <option value="DRAFT">پیش‌نویس کاری فعلی</option>
                {projectVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({formatJalaliDisplay(v.versionDateJalali)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="cmp-right" className="font-medium text-slate-600">
                مقایسه با (ب):
              </label>
              <select
                id="cmp-right"
                value={resolvedRightId}
                onChange={(e) => setCompareRight(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
              >
                <option value="DRAFT">پیش‌نویس کاری فعلی</option>
                <option value="BASE">قیمت پایه (مرجع ثابت)</option>
                {projectVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({formatJalaliDisplay(v.versionDateJalali)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {comparisonData && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs tabular-nums">
              <div>
                <div className="text-slate-500">{comparisonData.leftLabel}</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {formatCurrencyValue(
                    comparisonData.leftTotal,
                    activeProject.currency
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500">{comparisonData.rightLabel}</div>
                <div className="mt-1 text-base font-bold text-sky-900">
                  {formatCurrencyValue(
                    comparisonData.rightTotal,
                    activeProject.currency
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500">اختلاف (ب نسبت به الف)</div>
                <div
                  className={`mt-1 text-base font-extrabold ${
                    comparisonData.totalDiff > 0
                      ? 'text-red-700'
                      : comparisonData.totalDiff < 0
                        ? 'text-emerald-700'
                        : 'text-slate-800'
                  }`}
                >
                  {formatNumberFa(comparisonData.totalDiff, { showPlus: true })}{' '}
                  ({formatPercentFa(comparisonData.totalPct, { showPlus: true })})
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">نام هزینه</th>
                    <th className="px-3 py-2.5 font-semibold">دسته</th>
                    <th className="px-3 py-2.5 font-semibold">مبلغ الف</th>
                    <th className="px-3 py-2.5 font-semibold">مبلغ ب</th>
                    <th className="px-3 py-2.5 font-semibold">اختلاف مبلغی</th>
                    <th className="px-3 py-2.5 font-semibold">اختلاف درصدی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {comparisonData.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {r.title}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.categoryName}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatNumberFa(r.leftAmt)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {formatNumberFa(r.rightAmt)}
                      </td>
                      <td
                        className={`px-3 py-2 font-medium ${
                          r.diff > 0
                            ? 'text-red-700'
                            : r.diff < 0
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {formatNumberFa(r.diff, { showPlus: true })}
                      </td>
                      <td
                        className={`px-3 py-2 font-medium ${
                          r.pct > 0
                            ? 'text-red-700'
                            : r.pct < 0
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {formatPercentFa(r.pct, { showPlus: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Edit Saved Version Metadata Modal */}
      {editingVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              ویرایش مشخصات نسخهٔ ذخیره‌شده
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              توجه: ارقام و مبالغ محاسبه‌شدهٔ این نسخه تغییر نخواهند کرد؛ فقط نام، تاریخ و توضیحات آن ویرایش می‌شود.
            </p>
            <form onSubmit={handleRequestSaveEdit} className="mt-4 space-y-3">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {editError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  نام نسخه
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  تاریخ شمسی
                </label>
                <input
                  type="text"
                  value={editDate}
                  onChange={(e) => setEditDate(normalizeDigits(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  توضیحات
                </label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVersion(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  ثبت تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmEditOpen}
        title="تأیید ویرایش نسخهٔ ذخیره‌شده"
        description="آیا از تغییر نام، تاریخ یا توضیحات این نسخهٔ تاریخی مطمئن هستید؟"
        tone="warning"
        confirmLabel="تأیید ویرایش"
        onCancel={() => setConfirmEditOpen(false)}
        onConfirm={async () => {
          if (!editingVersion) return;
          await updatePricingVersionMeta(editingVersion.id, {
            name: editName.trim(),
            versionDateJalali: editDate.trim(),
            description: editDesc.trim(),
          });
          setConfirmEditOpen(false);
          setEditingVersion(null);
        }}
      />

      <ConfirmModal
        open={Boolean(versionToDelete)}
        title="تأیید حذف نسخهٔ قیمت‌گذاری"
        description={
          versionToDelete
            ? `آیا از حذف کامل نسخهٔ «${versionToDelete.name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`
            : ''
        }
        confirmLabel="حذف نسخه"
        onCancel={() => setVersionToDelete(null)}
        onConfirm={async () => {
          if (!versionToDelete) return;
          await deletePricingVersion(versionToDelete.id);
          setVersionToDelete(null);
        }}
      />
    </div>
  );
}
