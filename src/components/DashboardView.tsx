'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpLeft,
  Building2,
  Calendar,
  Download,
  FileSpreadsheet,
  Info,
  Layers,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { AiCostAnalysis, AppSection } from '../types/app';
import { formatJalaliDisplay } from '../utils/jalali';
import {
  formatCurrencyValue,
  formatNumberFa,
  formatPercentFa,
} from '../utils/pricing';
import { createProjectExportWorkbook } from '../utils/excelParser';

interface DashboardViewProps {
  onNavigate: (section: AppSection) => void;
  onOpenEditProject: () => void;
  onOpenNewVersion: () => void;
}

export function DashboardView({
  onNavigate,
  onOpenEditProject,
  onOpenNewVersion,
}: DashboardViewProps) {
  const {
    activeProject,
    projectExpenses,
    projectVersions,
    selectedVersionId,
    setSelectedVersionId,
    activeVersion,
    displayedValuation,
    updateProject,
  } = useWorkspace();

  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiCostAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const latestVersion = projectVersions[0] ?? null;

  // Chronological trend points (Base + Versions oldest -> newest)
  const trendPoints = useMemo(() => {
    const ordered = [...projectVersions].reverse();
    const pts: Array<{
      label: string;
      dateJalali: string;
      amount: number;
      diffPercent: number;
      isBase?: boolean;
    }> = [
      {
        label: 'قیمت پایه',
        dateJalali: activeProject?.startDateJalali || 'مرجع ثابت',
        amount: displayedValuation.totalBaseAmount,
        diffPercent: 0,
        isBase: true,
      },
    ];

    for (const v of ordered) {
      pts.push({
        label: v.name,
        dateJalali: v.versionDateJalali,
        amount: v.totalEstimatedAmount,
        diffPercent: v.diffFromBasePercent,
      });
    }

    return pts;
  }, [projectVersions, activeProject?.startDateJalali, displayedValuation.totalBaseAmount]);

  if (!activeProject) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <Building2 className="mx-auto h-10 w-10 text-slate-400" />
        <h2 className="mt-3 text-base font-bold text-slate-900">
          هیچ پروژه‌ای انتخاب نشده است
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          برای شروع، از بخش پروژه‌ها یک پروژهٔ ساختمانی جدید ایجاد کنید.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          مدیریت پروژه‌ها
        </button>
      </div>
    );
  }

  const handleExportExcel = () => {
    const bytes = createProjectExportWorkbook({
      projectName: activeProject.name,
      currency: activeProject.currency,
      versionName: activeVersion ? activeVersion.name : 'پیش‌نویس کاری فعلی',
      versionDateJalali: activeVersion
        ? activeVersion.versionDateJalali
        : activeProject.startDateJalali || '—',
      taxPercent: displayedValuation.taxPercent,
      areaSqm: activeProject.areaSqm,
      usefulAreaSqm: activeProject.usefulAreaSqm,
      landPrice: displayedValuation.partnership.landPrice,
      partnershipPercent: displayedValuation.partnership.partnershipPercent,
      items: displayedValuation.items,
      versions: projectVersions,
      expenses: projectExpenses,
    });
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `گزارش-${activeProject.name}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeWithAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const topItems = [...displayedValuation.items]
        .sort((a, b) => b.estimatedAmount - a.estimatedAmount)
        .slice(0, 8);

      const res = await fetch('/api/ai/analyze-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: activeProject.name,
          currency: activeProject.currency,
          areaSqm: activeProject.areaSqm,
          totalBaseAmount: displayedValuation.totalBaseAmount,
          totalEstimatedAmount: displayedValuation.totalEstimatedAmount,
          diffPercent: displayedValuation.diffFromBasePercent,
          versionName: activeVersion?.name ?? 'پیش‌نویس کاری فعلی',
          categoryBreakdown: displayedValuation.categoryBreakdown,
          topItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'تحلیل هوشمند انجام نشد.');
      } else {
        setAiAnalysis(data as AiCostAnalysis);
      }
    } catch {
      setAiError('خطا در برقراری ارتباط با سرویس تحلیل هوشمند.');
    } finally {
      setAiLoading(false);
    }
  };

  const maxTrendVal = Math.max(...trendPoints.map((p) => p.amount), 1);
  const minTrendVal = Math.min(...trendPoints.map((p) => p.amount), maxTrendVal);
  const trendSpan = Math.max(maxTrendVal - minTrendVal, maxTrendVal * 0.1 || 1);

  return (
    <div className="space-y-6">
      {/* Currency unset alert — never guess currency */}
      {activeProject.currency === 'تعیین‌نشده' && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-950">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-700" />
            <span>
              واحد پول این پروژه هنوز مشخص نشده است (تعیین‌نشده). لطفاً واحد پول واقعی مبالغ را تأیید کنید:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateProject(activeProject.id, { currency: 'تومان' })}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
            >
              تنظیم به تومان
            </button>
            <button
              type="button"
              onClick={() => updateProject(activeProject.id, { currency: 'ریال' })}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
            >
              تنظیم به ریال
            </button>
          </div>
        </div>
      )}

      {/* PDF Reconciliation / Audit notice */}
      {activeProject.pdfAuditNote && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-5 py-3.5 text-sm text-sky-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 font-medium">
              <Info className="h-4 w-4 shrink-0 text-sky-700" />
              <span>
                گزارش تطبیق فایل پی‌دی‌اف نمونه: اختلاف ۳۴۰٬۰۰۰٬۰۰۰ بین جمع ردیف‌ها و جمع چاپ‌شده در سند شناسایی و بدون تغییر پنهانی ثبت شد.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAuditDetails((s) => !s)}
              className="text-xs font-semibold text-sky-800 underline underline-offset-4 hover:text-sky-950 whitespace-nowrap shrink-0"
            >
              {showAuditDetails ? 'بستن جزئیات تطبیق' : 'مشاهده جزئیات تطبیق'}
            </button>
          </div>
          {showAuditDetails && (
            <p className="mt-2.5 border-t border-sky-200/80 pt-2.5 text-xs leading-6 text-sky-900">
              {activeProject.pdfAuditNote}
            </p>
          )}
        </div>
      )}

      {/* Project Header & Active Version Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{activeProject.status}</span>
            <span aria-hidden="true">·</span>
            <span>واحد پول: {activeProject.currency}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              مالیات: {formatPercentFa(displayedValuation.taxPercent)}
            </span>
            {activeProject.areaSqm && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  زیربنای کل: {formatNumberFa(activeProject.areaSqm)} مترمربع
                </span>
              </>
            )}
            {activeProject.usefulAreaSqm && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  زیربنای مفید: {formatNumberFa(activeProject.usefulAreaSqm)} مترمربع
                </span>
              </>
            )}
            {displayedValuation.partnership.landPrice > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  قیمت زمین:{' '}
                  {formatCurrencyValue(
                    displayedValuation.partnership.landPrice,
                    activeProject.currency
                  )}
                </span>
              </>
            )}
            {displayedValuation.partnership.partnershipPercent !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  مشارکت:{' '}
                  {formatPercentFa(
                    displayedValuation.partnership.partnershipPercent
                  )}
                </span>
              </>
            )}
            {activeProject.startDateJalali && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  شروع: {formatJalaliDisplay(activeProject.startDateJalali)}
                </span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            {activeProject.name}
          </h1>
          {activeVersion && (
            <p className="mt-1 text-xs font-medium text-sky-800">
              در حال نمایش نسخهٔ «{activeVersion.name}» ({formatJalaliDisplay(activeVersion.versionDateJalali)})
              {' — '}
              {activeVersion.baseReferenceType === 'VERSION' &&
              activeVersion.parentVersionName
                ? `مبنای محاسبه: نسخهٔ ${activeVersion.parentVersionName}`
                : 'مبنای محاسبه: قیمت پایهٔ ثابت'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label
              htmlFor="dashboard-version-select"
              className="text-xs font-medium text-slate-600 whitespace-nowrap"
            >
              نمای برآورد:
            </label>
            <select
              id="dashboard-version-select"
              value={selectedVersionId === 'draft' ? 'draft' : String(selectedVersionId)}
              onChange={(e) =>
                setSelectedVersionId(
                  e.target.value === 'draft' ? 'draft' : Number(e.target.value)
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
            >
              <option value="draft">پیش‌نویس کاری فعلی</option>
              {projectVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({formatJalaliDisplay(v.versionDateJalali)})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            خروجی اکسل
          </button>

          <button
            type="button"
            onClick={onOpenNewVersion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            ثبت نسخهٔ جدید
          </button>
        </div>
      </div>

      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            مجموع قیمت پایه (مرجع ثابت)
          </div>
          <div className="mt-2 text-lg font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
            {formatCurrencyValue(
              displayedValuation.totalBaseAmount,
              activeProject.currency
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {formatNumberFa(displayedValuation.items.length)} ردیف هزینهٔ پایه
          </div>
          {displayedValuation.taxPercent > 0 && (
            <div className="mt-1 text-[11px] text-slate-600 tabular-nums">
              با مالیات ({formatPercentFa(displayedValuation.taxPercent)}):{' '}
              <span className="font-semibold text-slate-900">
                {formatCurrencyValue(
                  displayedValuation.totalBaseWithTax,
                  activeProject.currency
                )}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            {activeVersion ? `برآورد ${activeVersion.name}` : 'برآورد پیش‌نویس فعلی'}
          </div>
          <div className="mt-2 text-lg font-extrabold text-sky-900 tabular-nums whitespace-nowrap">
            {formatCurrencyValue(
              displayedValuation.totalEstimatedAmount,
              activeProject.currency
            )}
          </div>
          {displayedValuation.taxPercent > 0 && (
            <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600 tabular-nums">
              <div>
                مالیات ({formatPercentFa(displayedValuation.taxPercent)}):{' '}
                {formatCurrencyValue(
                  displayedValuation.estimatedTaxAmount,
                  activeProject.currency
                )}
              </div>
              <div>
                با مالیات:{' '}
                <span className="font-semibold text-slate-900">
                  {formatCurrencyValue(
                    displayedValuation.totalEstimatedWithTax,
                    activeProject.currency
                  )}
                </span>
              </div>
            </div>
          )}
          <div
            className={`mt-2 flex items-center gap-1 text-xs font-semibold tabular-nums ${
              displayedValuation.diffFromBaseAmount > 0
                ? 'text-red-700'
                : displayedValuation.diffFromBaseAmount < 0
                  ? 'text-emerald-700'
                  : 'text-slate-600'
            }`}
          >
            {displayedValuation.diffFromBaseAmount > 0 ? (
              <ArrowUpLeft className="h-3.5 w-3.5 shrink-0" />
            ) : displayedValuation.diffFromBaseAmount < 0 ? (
              <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
            ) : null}
            <span>
              {formatNumberFa(displayedValuation.diffFromBaseAmount, {
                showPlus: true,
              })}{' '}
              (
              {formatPercentFa(displayedValuation.diffFromBasePercent, {
                showPlus: true,
              })}
              )
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            هزینهٔ هر مترمربع (برآوردی / پایه)
          </div>
          {displayedValuation.estimatedPerSqm !== null ||
          displayedValuation.estimatedPerUsefulSqm !== null ? (
            <div className="mt-2 space-y-2 text-xs tabular-nums">
              {displayedValuation.estimatedPerSqm !== null &&
                displayedValuation.basePerSqm !== null && (
                  <div>
                    <div className="text-[11px] text-slate-500">
                      زیربنای کل:
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {formatCurrencyValue(
                        displayedValuation.estimatedPerSqm,
                        activeProject.currency
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      پایه:{' '}
                      {formatCurrencyValue(
                        displayedValuation.basePerSqm,
                        activeProject.currency
                      )}
                    </div>
                  </div>
                )}
              {displayedValuation.estimatedPerUsefulSqm !== null &&
                displayedValuation.basePerUsefulSqm !== null && (
                  <div
                    className={
                      displayedValuation.estimatedPerSqm !== null
                        ? 'border-t border-slate-100 pt-1.5'
                        : ''
                    }
                  >
                    <div className="text-[11px] text-slate-500">
                      زیربنای مفید:
                    </div>
                    <div className="text-sm font-extrabold text-sky-900">
                      {formatCurrencyValue(
                        displayedValuation.estimatedPerUsefulSqm,
                        activeProject.currency
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      پایه:{' '}
                      {formatCurrencyValue(
                        displayedValuation.basePerUsefulSqm,
                        activeProject.currency
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="mt-2">
              <div className="text-sm font-semibold text-slate-700">
                متراژ زیربنا ثبت نشده است
              </div>
              <button
                type="button"
                onClick={onOpenEditProject}
                className="mt-2 text-xs font-semibold text-sky-800 underline underline-offset-4 hover:text-sky-950"
              >
                ثبت زیربنای کل و مفید در مشخصات پروژه
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            آخرین نسخهٔ قیمت‌گذاری
          </div>
          {latestVersion ? (
            <>
              <div className="mt-2 text-base font-bold text-slate-900 truncate">
                {latestVersion.name}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatJalaliDisplay(latestVersion.versionDateJalali)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatNumberFa(projectVersions.length)} نسخه</span>
              </div>
            </>
          ) : (
            <div className="mt-2">
              <div className="text-sm font-semibold text-slate-700">
                هنوز نسخه‌ای ذخیره نشده
              </div>
              <button
                type="button"
                onClick={onOpenNewVersion}
                className="mt-2 text-xs font-semibold text-sky-800 underline underline-offset-4 hover:text-sky-950"
              >
                ساخت اولین نسخهٔ قیمت‌گذاری
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Land Price & Partnership Share Summary Strip (shown when landPrice > 0 or partnershipPercent set) */}
      {(displayedValuation.partnership.landPrice > 0 ||
        displayedValuation.partnership.partnershipPercent !== null) && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-sky-200 bg-sky-50/50 p-5 sm:grid-cols-3 text-xs tabular-nums">
          <div>
            <div className="font-medium text-slate-600">
              جمع کل با احتساب قیمت زمین
            </div>
            <div className="mt-1.5 text-base font-extrabold text-slate-950">
              {formatCurrencyValue(
                displayedValuation.partnership.totalEstimatedWithLand,
                activeProject.currency
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-600">
              قیمت زمین:{' '}
              {formatCurrencyValue(
                displayedValuation.partnership.landPrice,
                activeProject.currency
              )}
              {displayedValuation.taxPercent > 0 && (
                <>
                  {' · '}
                  با مالیات و زمین:{' '}
                  {formatCurrencyValue(
                    displayedValuation.partnership.totalEstimatedWithLandAndTax,
                    activeProject.currency
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <div className="font-medium text-slate-600">
              هزینهٔ هر مترمربع با زمین
            </div>
            <div className="mt-1.5 space-y-1">
              {displayedValuation.partnership.estimatedPerTotalSqmWithLand !==
                null && (
                <div>
                  زیربنای کل:{' '}
                  <strong className="text-slate-900">
                    {formatCurrencyValue(
                      displayedValuation.partnership
                        .estimatedPerTotalSqmWithLand,
                      activeProject.currency
                    )}
                  </strong>
                </div>
              )}
              {displayedValuation.partnership.estimatedPerUsefulSqmWithLand !==
                null && (
                <div>
                  زیربنای مفید:{' '}
                  <strong className="text-sky-900">
                    {formatCurrencyValue(
                      displayedValuation.partnership
                        .estimatedPerUsefulSqmWithLand,
                      activeProject.currency
                    )}
                  </strong>
                </div>
              )}
              {displayedValuation.partnership.estimatedPerTotalSqmWithLand ===
                null &&
                displayedValuation.partnership.estimatedPerUsefulSqmWithLand ===
                  null && (
                  <span className="text-slate-500">
                    متراژ زیربنا ثبت نشده است
                  </span>
                )}
            </div>
          </div>

          <div>
            <div className="font-semibold text-sky-950">
              سود مشارکت (هر مترمربع سهم سازنده)
            </div>
            {displayedValuation.partnership.partnershipCostPerBuilderUsefulSqm !==
              null &&
            displayedValuation.partnership.builderUsefulAreaSqm !== null ? (
              <>
                <div className="mt-1.5 text-base font-extrabold text-sky-950">
                  {formatCurrencyValue(
                    displayedValuation.partnership
                      .partnershipCostPerBuilderUsefulSqm,
                    activeProject.currency
                  )}
                </div>
                <div className="mt-1 text-[11px] text-sky-900">
                  سهم سازنده:{' '}
                  {formatNumberFa(
                    displayedValuation.partnership.builderUsefulAreaSqm,
                    { maxDecimals: 2 }
                  )}{' '}
                  مترمربع (
                  {formatPercentFa(
                    displayedValuation.partnership.partnershipPercent ?? 0
                  )}
                  )
                </div>
              </>
            ) : (
              <div className="mt-1.5">
                <div className="text-slate-600">
                  نیازمند ثبت زیربنای مفید و درصد مشارکت
                </div>
                <button
                  type="button"
                  onClick={onOpenEditProject}
                  className="mt-1 text-[11px] font-semibold text-sky-800 underline underline-offset-4 hover:text-sky-950"
                >
                  تکمیل مشخصات پروژه
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Row: Category Share & Version Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category Breakdown */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">
                سهم هر دسته از کل هزینه
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-semibold text-sky-800 hover:underline"
            >
              مشاهده جدول کامل
            </button>
          </div>

          {displayedValuation.categoryBreakdown.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              هنوز هزینه‌ای در این پروژه ثبت نشده است.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {displayedValuation.categoryBreakdown.map((cat) => (
                <div key={cat.categoryName} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <div className="font-semibold text-slate-800">
                      {cat.categoryName}{' '}
                      <span className="font-normal text-slate-500 tabular-nums">
                        ({formatNumberFa(cat.itemCount)} ردیف)
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 tabular-nums">
                      {formatPercentFa(cat.shareOfEstimatedPercent)}
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-sky-800 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(1.5, cat.shareOfEstimatedPercent)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                    <span>
                      پایه: {formatCurrencyValue(cat.baseAmount, activeProject.currency)}
                    </span>
                    <span>
                      برآوردی:{' '}
                      {formatCurrencyValue(cat.estimatedAmount, activeProject.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Version Price Trend Chart */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">
                روند قیمت نسخه‌ها در طول زمان
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('versions')}
              className="text-xs font-semibold text-sky-800 hover:underline"
            >
              مقایسه و تاریخچه نسخه‌ها
            </button>
          </div>

          {trendPoints.length <= 1 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-slate-600">
                برای نمایش نمودار روند تغییر قیمت، حداقل یک نسخهٔ قیمت‌گذاری ثبت کنید.
              </p>
              <button
                type="button"
                onClick={onOpenNewVersion}
                className="mt-3 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                ثبت اولین نسخه
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox="0 0 560 220"
                  className="h-52 w-full min-w-[420px]"
                  role="img"
                  aria-label="نمودار روند قیمت نسخه‌های پروژه"
                >
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const y = 24 + t * 140;
                    return (
                      <line
                        key={t}
                        x1="36"
                        y1={y}
                        x2="532"
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                      />
                    );
                  })}

                  {/* Line path */}
                  <polyline
                    fill="none"
                    stroke="#075985"
                    strokeWidth="2.5"
                    points={trendPoints
                      .map((pt, idx) => {
                        const x =
                          trendPoints.length === 1
                            ? 280
                            : 84 +
                              (idx / (trendPoints.length - 1)) * (476 - 84);
                        const y =
                          164 - ((pt.amount - minTrendVal) / trendSpan) * 124;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />

                  {/* Points & Labels */}
                  {trendPoints.map((pt, idx) => {
                    const x =
                      trendPoints.length === 1
                        ? 280
                        : 84 + (idx / (trendPoints.length - 1)) * (476 - 84);
                    const y =
                      164 - ((pt.amount - minTrendVal) / trendSpan) * 124;
                    return (
                      <g key={`${pt.label}-${idx}`}>
                        <circle
                          cx={x}
                          cy={y}
                          r="5"
                          fill={pt.isBase ? '#0f172a' : '#075985'}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#0f172a"
                          fontWeight="600"
                        >
                          {formatPercentFa(pt.diffPercent, { showPlus: !pt.isBase })}
                        </text>
                        <text
                          x={x}
                          y="186"
                          textAnchor="middle"
                          fontSize="10"
                          fill="#334155"
                        >
                          {pt.label.length > 18
                            ? `${pt.label.slice(0, 18)}…`
                            : pt.label}
                        </text>
                        <text
                          x={x}
                          y="202"
                          textAnchor="middle"
                          fontSize="9"
                          fill="#64748b"
                        >
                          {formatJalaliDisplay(pt.dateJalali)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-xs">
                {trendPoints.map((pt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 tabular-nums"
                  >
                    <span className="font-medium text-slate-700">
                      {pt.label} · {formatJalaliDisplay(pt.dateJalali)}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrencyValue(pt.amount, activeProject.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Smart AI Cost & Risk Analysis Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-sky-700" />
              تحلیل هوشمند ساختار هزینه و ریسک تورم
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              بررسی اقلام کلیدی، نقاط حساس هزینه و پیشنهادهای کنترل بودجه برای این پروژه
            </p>
          </div>
          <button
            type="button"
            onClick={handleAnalyzeWithAi}
            disabled={aiLoading || displayedValuation.items.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {aiLoading ? 'در حال تحلیل...' : 'تحلیل هوشمند نسخه'}
          </button>
        </div>

        {aiError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            {aiError}
          </div>
        )}

        {aiAnalysis && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 text-sm">
            <p className="leading-7 text-slate-800">{aiAnalysis.summary}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-bold text-slate-900">
                  پیشران‌های اصلی هزینه
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pr-4 text-xs leading-6 text-slate-700">
                  {aiAnalysis.keyDrivers.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <h3 className="text-xs font-bold text-amber-900">
                  ریسک‌های تورمی و حساسیت
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pr-4 text-xs leading-6 text-amber-950">
                  {aiAnalysis.riskWarnings.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                <h3 className="text-xs font-bold text-emerald-900">
                  پیشنهادهای کنترل هزینه
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pr-4 text-xs leading-6 text-emerald-950">
                  {aiAnalysis.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
