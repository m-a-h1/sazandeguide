'use client';

import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { ExpenseItem } from '../types/app';
import { formatJalaliDisplay, isJalaliInRange, normalizeDigits } from '../utils/jalali';
import {
  computePartnershipMetrics,
  computePerSqm,
  formatCurrencyValue,
  formatNumberFa,
  formatPercentFa,
  parseStrictNumericInput,
} from '../utils/pricing';
import { createProjectExportWorkbook } from '../utils/excelParser';
import { ConfirmModal } from './ConfirmModal';

interface ExpensesRatesViewProps {
  onOpenManualAdd: () => void;
  onOpenManualEdit: (expense: ExpenseItem) => void;
  onOpenExcelImport: () => void;
  onOpenNewVersion: () => void;
}

export function ExpensesRatesView({
  onOpenManualAdd,
  onOpenManualEdit,
  onOpenExcelImport,
  onOpenNewVersion,
}: ExpensesRatesViewProps) {
  const {
    activeProject,
    projectCategories,
    projectExpenses,
    projectVersions,
    selectedVersionId,
    setSelectedVersionId,
    activeVersion,
    displayedValuation,
    updateDraftCategoryRate,
    updateExpense,
    setSubcategoryOverride,
    deleteExpense,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('همه');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('همه');
  const [filterRateType, setFilterRateType] = useState<
    'همه' | 'CATEGORY' | 'INDEPENDENT'
  >('همه');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Subcategory bulk rate state
  const [bulkCat, setBulkCat] = useState<string>('');
  const [bulkSub, setBulkSub] = useState<string>('');
  const [bulkPercentRaw, setBulkPercentRaw] = useState<string>('');

  // Inline item override editor
  const [editingOverrideId, setEditingOverrideId] = useState<number | null>(null);
  const [overrideInputRaw, setOverrideInputRaw] = useState<string>('');

  // Delete expense confirmation
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);

  const isReadOnlyVersion = Boolean(activeVersion);

  const allSubcategoriesForFilter = useMemo(() => {
    const subs = new Set<string>();
    for (const item of displayedValuation.items) {
      if (filterCategory === 'همه' || item.categoryName === filterCategory) {
        if (item.subcategory) subs.add(item.subcategory);
      }
    }
    return Array.from(subs);
  }, [displayedValuation.items, filterCategory]);

  const subcategoriesForBulk = useMemo(() => {
    const targetCat = bulkCat || projectCategories[0]?.name || '';
    const subs = new Set<string>();
    const catObj = projectCategories.find((c) => c.name === targetCat);
    catObj?.subcategories.forEach((s) => subs.add(s));
    projectExpenses
      .filter((e) => e.categoryName === targetCat && e.subcategory)
      .forEach((e) => subs.add(e.subcategory));
    return Array.from(subs);
  }, [bulkCat, projectCategories, projectExpenses]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayedValuation.items.filter((item) => {
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.categoryName.toLowerCase().includes(q) &&
        !item.subcategory.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filterCategory !== 'همه' && item.categoryName !== filterCategory) {
        return false;
      }
      if (
        filterSubcategory !== 'همه' &&
        item.subcategory !== filterSubcategory
      ) {
        return false;
      }
      if (filterRateType !== 'همه' && item.rateSource !== filterRateType) {
        return false;
      }
      if (
        (dateFrom.trim() || dateTo.trim()) &&
        !isJalaliInRange(item.dateJalali, dateFrom, dateTo)
      ) {
        return false;
      }
      return true;
    });
  }, [
    displayedValuation.items,
    searchQuery,
    filterCategory,
    filterSubcategory,
    filterRateType,
    dateFrom,
    dateTo,
  ]);

  const displayedTaxPercent = displayedValuation.taxPercent;
  const displayedLandPrice = displayedValuation.partnership.landPrice;
  const displayedPartnershipPercent =
    displayedValuation.partnership.partnershipPercent;

  const filteredTotals = useMemo(() => {
    let base = 0;
    let est = 0;
    for (const item of filteredItems) {
      base += item.baseAmount;
      est += item.estimatedAmount;
    }
    const taxAmount = est * (displayedTaxPercent / 100);
    const estWithTax = est + taxAmount;
    return {
      base,
      est,
      taxAmount,
      estWithTax,
      diff: est - base,
      pct: base > 0 ? ((est - base) / base) * 100 : 0,
    };
  }, [filteredItems, displayedTaxPercent]);

  const filteredPartnership = useMemo(
    () =>
      computePartnershipMetrics({
        pureBaseAmount: filteredTotals.base,
        pureEstimatedAmount: filteredTotals.est,
        taxPercent: displayedTaxPercent,
        landPrice: displayedLandPrice,
        areaSqm: activeProject?.areaSqm,
        usefulAreaSqm: activeProject?.usefulAreaSqm,
        partnershipPercent: displayedPartnershipPercent,
      }),
    [
      filteredTotals.base,
      filteredTotals.est,
      displayedTaxPercent,
      displayedLandPrice,
      activeProject?.areaSqm,
      activeProject?.usefulAreaSqm,
      displayedPartnershipPercent,
    ]
  );

  if (!activeProject) return null;

  const handleSaveOverride = async (expenseId: number) => {
    const parsed = parseStrictNumericInput(overrideInputRaw);
    if (parsed === null) return;
    await updateExpense(expenseId, { overridePercent: parsed });
    setEditingOverrideId(null);
    setOverrideInputRaw('');
  };

  const handleClearOverride = async (expenseId: number) => {
    await updateExpense(expenseId, { overridePercent: null });
    if (editingOverrideId === expenseId) {
      setEditingOverrideId(null);
    }
  };

  const handleApplySubcategoryRate = async (clear: boolean) => {
    const cat = bulkCat || projectCategories[0]?.name || '';
    const sub = bulkSub || subcategoriesForBulk[0] || '';
    if (!cat || !sub) return;
    if (clear) {
      await setSubcategoryOverride(cat, sub, null);
      setBulkPercentRaw('');
      return;
    }
    const parsed = parseStrictNumericInput(bulkPercentRaw);
    if (parsed === null) return;
    await setSubcategoryOverride(cat, sub, parsed);
  };

  const handleExportFiltered = () => {
    const bytes = createProjectExportWorkbook({
      projectName: activeProject.name,
      currency: activeProject.currency,
      versionName: activeVersion ? activeVersion.name : 'پیش‌نویس کاری فعلی',
      versionDateJalali: activeVersion
        ? activeVersion.versionDateJalali
        : activeProject.startDateJalali || '—',
      taxPercent: displayedTaxPercent,
      areaSqm: activeProject.areaSqm,
      usefulAreaSqm: activeProject.usefulAreaSqm,
      landPrice: displayedLandPrice,
      partnershipPercent: displayedPartnershipPercent,
      items: filteredItems,
      versions: projectVersions,
      expenses: projectExpenses,
    });
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `هزینه‌ها-${activeProject.name}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            جدول هزینه‌ها و تنظیم نرخ‌های تعدیل
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            قانون اولویت نرخ: در صورت ثبت درصد مستقل برای یک هزینه، فقط همان درصد جایگزین درصد دسته می‌شود و با آن جمع نمی‌شود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="انتخاب نسخه نمایش در جدول هزینه‌ها"
            value={selectedVersionId === 'draft' ? 'draft' : String(selectedVersionId)}
            onChange={(e) =>
              setSelectedVersionId(
                e.target.value === 'draft' ? 'draft' : Number(e.target.value)
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
          >
            <option value="draft">پیش‌نویس کاری فعلی (قابل ویرایش)</option>
            {projectVersions.map((v) => (
              <option key={v.id} value={v.id}>
                نسخه: {v.name} ({formatJalaliDisplay(v.versionDateJalali)})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenExcelImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            ورود از اکسل
          </button>

          <button
            type="button"
            onClick={onOpenManualAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            ثبت دستی هزینه
          </button>

          <button
            type="button"
            onClick={handleExportFiltered}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            خروجی اکسل
          </button>

          {!isReadOnlyVersion && (
            <button
              type="button"
              onClick={onOpenNewVersion}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              ذخیره به‌عنوان نسخهٔ جدید
            </button>
          )}
        </div>
      </div>

      {/* Read-only notice when inspecting a saved version */}
      {isReadOnlyVersion && activeVersion && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-5 py-3.5 text-sm text-sky-950">
          <span>
            در حال مشاهدهٔ تصویر ثابت نسخهٔ «{activeVersion.name}» ({formatJalaliDisplay(activeVersion.versionDateJalali)}) هستید. نسخه‌های ذخیره‌شده با تغییر نرخ‌های جدید تغییر نمی‌کنند.
          </span>
          <button
            type="button"
            onClick={() => setSelectedVersionId('draft')}
            className="rounded-lg border border-sky-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100 whitespace-nowrap shrink-0"
          >
            بازگشت به پیش‌نویس کاری
          </button>
        </div>
      )}

      {/* Category & Subcategory Rate Adjuster (Draft mode only) */}
      {!isReadOnlyVersion && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              درصد تعدیل دسته‌های اصلی (درصد منفی برای کاهش مجاز است)
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
              {projectCategories.map((cat) => {
                const currentRate =
                  activeProject.draftCategoryRates?.[cat.name] ?? 0;
                return (
                  <div
                    key={cat.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <label
                      htmlFor={`cat-rate-${cat.id}`}
                      className="block text-xs font-semibold text-slate-800 truncate"
                      title={cat.name}
                    >
                      {cat.name}
                    </label>
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        id={`cat-rate-${cat.id}`}
                        type="number"
                        step="0.5"
                        value={currentRate}
                        onChange={(e) =>
                          updateDraftCategoryRate(
                            cat.name,
                            Number(e.target.value || 0)
                          )
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none"
                      />
                      <span className="text-xs font-semibold text-slate-500">
                        ٪
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subcategory bulk independent rate setter */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold text-slate-800">
              اعمال یا حذف درصد مستقل برای یک زیردسته / بخش
            </h3>
            <div className="mt-2.5 flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="bulk-cat"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  دسته اصلی
                </label>
                <select
                  id="bulk-cat"
                  value={bulkCat || projectCategories[0]?.name || ''}
                  onChange={(e) => {
                    setBulkCat(e.target.value);
                    setBulkSub('');
                  }}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                >
                  {projectCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bulk-sub"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  زیردسته / بخش
                </label>
                <select
                  id="bulk-sub"
                  value={bulkSub || subcategoriesForBulk[0] || ''}
                  onChange={(e) => setBulkSub(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                >
                  {subcategoriesForBulk.length === 0 ? (
                    <option value="">بدون زیردسته</option>
                  ) : (
                    subcategoriesForBulk.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bulk-percent"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  درصد مستقل (٪)
                </label>
                <input
                  id="bulk-percent"
                  type="text"
                  inputMode="decimal"
                  value={bulkPercentRaw}
                  onChange={(e) =>
                    setBulkPercentRaw(normalizeDigits(e.target.value))
                  }
                  placeholder="مثال: ۱۲"
                  className="mt-1 w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 tabular-nums"
                />
              </div>

              <button
                type="button"
                disabled={subcategoriesForBulk.length === 0}
                onClick={() => handleApplySubcategoryRate(false)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                اعمال درصد مستقل به زیردسته
              </button>

              <button
                type="button"
                disabled={subcategoriesForBulk.length === 0}
                onClick={() => handleApplySubcategoryRate(true)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                بازگرداندن زیردسته به نرخ دسته
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Filter Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="exp-search"
              className="block text-[11px] font-medium text-slate-600"
            >
              جست‌وجو در نام هزینه یا دسته
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="exp-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجوی هزینه..."
                className="w-full rounded-lg border border-slate-300 py-1.5 pr-9 pl-3 text-xs text-slate-900 focus:border-sky-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="filter-cat"
              className="block text-[11px] font-medium text-slate-600"
            >
              دسته اصلی
            </label>
            <select
              id="filter-cat"
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setFilterSubcategory('همه');
              }}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="همه">همهٔ دسته‌ها</option>
              {projectCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-sub"
              className="block text-[11px] font-medium text-slate-600"
            >
              زیردسته
            </label>
            <select
              id="filter-sub"
              value={filterSubcategory}
              onChange={(e) => setFilterSubcategory(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="همه">همهٔ زیردسته‌ها</option>
              {allSubcategoriesForFilter.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-rate-type"
              className="block text-[11px] font-medium text-slate-600"
            >
              نوع نرخ
            </label>
            <select
              id="filter-rate-type"
              value={filterRateType}
              onChange={(e) =>
                setFilterRateType(
                  e.target.value as 'همه' | 'CATEGORY' | 'INDEPENDENT'
                )
              }
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="همه">همهٔ نرخ‌ها</option>
              <option value="CATEGORY">پیروی از دسته</option>
              <option value="INDEPENDENT">درصد مستقل</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-date-from"
              className="block text-[11px] font-medium text-slate-600"
            >
              از تاریخ شمسی
            </label>
            <input
              id="filter-date-from"
              type="text"
              value={dateFrom}
              onChange={(e) => setDateFrom(normalizeDigits(e.target.value))}
              placeholder="۱۴۰۵/۰۱/۰۱"
              className="mt-1 w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="filter-date-to"
              className="block text-[11px] font-medium text-slate-600"
            >
              تا تاریخ شمسی
            </label>
            <input
              id="filter-date-to"
              type="text"
              value={dateTo}
              onChange={(e) => setDateTo(normalizeDigits(e.target.value))}
              placeholder="۱۴۰۵/۱۲/۲۹"
              className="mt-1 w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 tabular-nums"
            />
          </div>

          {(searchQuery ||
            filterCategory !== 'همه' ||
            filterSubcategory !== 'همه' ||
            filterRateType !== 'همه' ||
            dateFrom ||
            dateTo) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('همه');
                setFilterSubcategory('همه');
                setFilterRateType('همه');
                setDateFrom('');
                setDateTo('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Filter className="h-3.5 w-3.5" />
              پاک‌کردن فیلترها
            </button>
          )}
        </div>

        {/* Section 1: Pure Construction Costs (without land) */}
        <div className="mt-4 border-t border-slate-100 pt-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs tabular-nums">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-bold text-slate-800">
                هزینه‌های خالص ساخت (بدون قیمت زمین)
              </span>
              <span aria-hidden="true" className="text-slate-300">
                |
              </span>
              <span>
                نمایش{' '}
                <span className="font-bold text-slate-900">
                  {formatNumberFa(filteredItems.length)}
                </span>{' '}
                ردیف از {formatNumberFa(displayedValuation.items.length)} هزینه
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span>
                جمع پایه:{' '}
                <strong className="text-slate-900">
                  {formatCurrencyValue(filteredTotals.base, activeProject.currency)}
                </strong>
              </span>
              <span>
                جمع برآوردی:{' '}
                <strong className="text-sky-900">
                  {formatCurrencyValue(filteredTotals.est, activeProject.currency)}
                </strong>
              </span>
              <span>
                مالیات ({formatPercentFa(displayedTaxPercent)}):{' '}
                <strong className="text-slate-900">
                  {formatCurrencyValue(
                    filteredTotals.taxAmount,
                    activeProject.currency
                  )}
                </strong>
              </span>
              <span>
                جمع کل با مالیات:{' '}
                <strong className="text-slate-950">
                  {formatCurrencyValue(
                    filteredTotals.estWithTax,
                    activeProject.currency
                  )}
                </strong>
              </span>
              <span
                className={
                  filteredTotals.diff > 0
                    ? 'font-semibold text-red-700'
                    : filteredTotals.diff < 0
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-slate-700'
                }
              >
                اختلاف:{' '}
                {formatNumberFa(filteredTotals.diff, { showPlus: true })} (
                {formatPercentFa(filteredTotals.pct, { showPlus: true })})
              </span>
            </div>
          </div>

          {/* Pure Per-square-meter prices: Total Area & Useful Area */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs tabular-nums">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <span className="font-semibold text-slate-800">
                  قیمت هر مترمربع زیربنای کل (خالص)
                </span>
                {activeProject.areaSqm && activeProject.areaSqm > 0 ? (
                  <span className="mr-1.5 text-[11px] text-slate-500">
                    ({formatNumberFa(activeProject.areaSqm)} مترمربع)
                  </span>
                ) : null}
              </div>
              {(() => {
                const estTotalSqm = computePerSqm(
                  filteredTotals.est,
                  activeProject.areaSqm
                );
                const baseTotalSqm = computePerSqm(
                  filteredTotals.base,
                  activeProject.areaSqm
                );
                const taxTotalSqm = computePerSqm(
                  filteredTotals.estWithTax,
                  activeProject.areaSqm
                );
                if (estTotalSqm === null || baseTotalSqm === null) {
                  return (
                    <span className="text-slate-500">
                      زیربنای کل در مشخصات پروژه ثبت نشده است
                    </span>
                  );
                }
                return (
                  <div className="text-left">
                    <div className="font-bold text-sky-900">
                      {formatCurrencyValue(estTotalSqm, activeProject.currency)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      پایه:{' '}
                      {formatCurrencyValue(baseTotalSqm, activeProject.currency)}
                      {displayedTaxPercent > 0 && taxTotalSqm !== null ? (
                        <>
                          {' · '}
                          با مالیات:{' '}
                          <span className="font-semibold text-slate-800">
                            {formatCurrencyValue(
                              taxTotalSqm,
                              activeProject.currency
                            )}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <span className="font-semibold text-slate-800">
                  قیمت هر مترمربع زیربنای مفید (خالص)
                </span>
                {activeProject.usefulAreaSqm &&
                activeProject.usefulAreaSqm > 0 ? (
                  <span className="mr-1.5 text-[11px] text-slate-500">
                    ({formatNumberFa(activeProject.usefulAreaSqm)} مترمربع)
                  </span>
                ) : null}
              </div>
              {(() => {
                const estUsefulSqm = computePerSqm(
                  filteredTotals.est,
                  activeProject.usefulAreaSqm
                );
                const baseUsefulSqm = computePerSqm(
                  filteredTotals.base,
                  activeProject.usefulAreaSqm
                );
                const taxUsefulSqm = computePerSqm(
                  filteredTotals.estWithTax,
                  activeProject.usefulAreaSqm
                );
                if (estUsefulSqm === null || baseUsefulSqm === null) {
                  return (
                    <span className="text-slate-500">
                      زیربنای مفید در مشخصات پروژه ثبت نشده است
                    </span>
                  );
                }
                return (
                  <div className="text-left">
                    <div className="font-bold text-sky-900">
                      {formatCurrencyValue(estUsefulSqm, activeProject.currency)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      پایه:{' '}
                      {formatCurrencyValue(baseUsefulSqm, activeProject.currency)}
                      {displayedTaxPercent > 0 && taxUsefulSqm !== null ? (
                        <>
                          {' · '}
                          با مالیات:{' '}
                          <span className="font-semibold text-slate-800">
                            {formatCurrencyValue(
                              taxUsefulSqm,
                              activeProject.currency
                            )}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Section 2: Land-Inclusive & Partnership Share Metrics */}
        <div className="mt-3.5 border-t border-slate-200 pt-3.5 space-y-3 text-xs tabular-nums">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-bold text-slate-900">
              هزینه‌ها با احتساب قیمت زمین و مشارکت
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-700">
              <span>
                قیمت زمین:{' '}
                <strong className="text-slate-900">
                  {formatCurrencyValue(
                    filteredPartnership.landPrice,
                    activeProject.currency
                  )}
                </strong>
              </span>
              <span>
                جمع کل با زمین:{' '}
                <strong className="text-sky-900">
                  {formatCurrencyValue(
                    filteredPartnership.totalEstimatedWithLand,
                    activeProject.currency
                  )}
                </strong>
              </span>
              {displayedTaxPercent > 0 && (
                <span>
                  جمع کل با زمین و مالیات:{' '}
                  <strong className="text-slate-950">
                    {formatCurrencyValue(
                      filteredPartnership.totalEstimatedWithLandAndTax,
                      activeProject.currency
                    )}
                  </strong>
                </span>
              )}
              <span>
                سهم سازنده از زیربنای مفید:{' '}
                <strong className="text-slate-900">
                  {filteredPartnership.builderUsefulAreaSqm !== null &&
                  filteredPartnership.partnershipPercent !== null
                    ? `${formatNumberFa(filteredPartnership.builderUsefulAreaSqm, { maxDecimals: 2 })} مترمربع (${formatPercentFa(filteredPartnership.partnershipPercent)})`
                    : 'تنظیم‌نشده'}
                </strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <span className="font-semibold text-slate-800">
                  مترمربع زیربنای کل (با زمین)
                </span>
                {activeProject.areaSqm && activeProject.areaSqm > 0 ? (
                  <span className="mr-1.5 text-[11px] text-slate-500">
                    ({formatNumberFa(activeProject.areaSqm)} مترمربع)
                  </span>
                ) : null}
              </div>
              {filteredPartnership.estimatedPerTotalSqmWithLand !== null &&
              filteredPartnership.basePerTotalSqmWithLand !== null ? (
                <div className="text-left">
                  <div className="font-bold text-slate-900">
                    {formatCurrencyValue(
                      filteredPartnership.estimatedPerTotalSqmWithLand,
                      activeProject.currency
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    پایه + زمین:{' '}
                    {formatCurrencyValue(
                      filteredPartnership.basePerTotalSqmWithLand,
                      activeProject.currency
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">زیربنای کل ثبت نشده است</span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <span className="font-semibold text-slate-800">
                  مترمربع زیربنای مفید (با زمین)
                </span>
                {activeProject.usefulAreaSqm &&
                activeProject.usefulAreaSqm > 0 ? (
                  <span className="mr-1.5 text-[11px] text-slate-500">
                    ({formatNumberFa(activeProject.usefulAreaSqm)} مترمربع)
                  </span>
                ) : null}
              </div>
              {filteredPartnership.estimatedPerUsefulSqmWithLand !== null &&
              filteredPartnership.basePerUsefulSqmWithLand !== null ? (
                <div className="text-left">
                  <div className="font-bold text-slate-900">
                    {formatCurrencyValue(
                      filteredPartnership.estimatedPerUsefulSqmWithLand,
                      activeProject.currency
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    پایه + زمین:{' '}
                    {formatCurrencyValue(
                      filteredPartnership.basePerUsefulSqmWithLand,
                      activeProject.currency
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">زیربنای مفید ثبت نشده است</span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-300 bg-sky-50/70 px-3.5 py-2.5">
              <div>
                <span className="font-bold text-sky-950">
                  سود مشارکت (هزینهٔ هر مترمربع سهم سازنده)
                </span>
                <div className="mt-0.5 text-[11px] text-sky-800">
                  {filteredPartnership.builderUsefulAreaSqm !== null
                    ? `(هزینه ساخت + قیمت زمین) ÷ ${formatNumberFa(filteredPartnership.builderUsefulAreaSqm, { maxDecimals: 2 })} مترمربع سهم سازنده`
                    : 'نیازمند ثبت زیربنای مفید و درصد مشارکت در مشخصات پروژه'}
                </div>
              </div>
              {filteredPartnership.partnershipCostPerBuilderUsefulSqm !== null ? (
                <div className="text-left">
                  <div className="text-sm font-extrabold text-sky-950">
                    {formatCurrencyValue(
                      filteredPartnership.partnershipCostPerBuilderUsefulSqm,
                      activeProject.currency
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-sky-900">
                    {displayedTaxPercent > 0 &&
                    filteredPartnership.partnershipCostWithTaxPerBuilderUsefulSqm !==
                      null ? (
                      <>
                        با مالیات:{' '}
                        <span className="font-semibold">
                          {formatCurrencyValue(
                            filteredPartnership.partnershipCostWithTaxPerBuilderUsefulSqm,
                            activeProject.currency
                          )}
                        </span>
                      </>
                    ) : null}
                    {displayedTaxPercent > 0 &&
                    filteredPartnership.landPrice > 0
                      ? ' · '
                      : null}
                    {filteredPartnership.landPrice > 0 &&
                    filteredPartnership.partnershipPureCostPerBuilderUsefulSqm !==
                      null ? (
                      <>
                        خالص ساخت:{' '}
                        {formatCurrencyValue(
                          filteredPartnership.partnershipPureCostPerBuilderUsefulSqm,
                          activeProject.currency
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <span className="text-[11px] font-medium text-sky-800">
                  تنظیم‌نشده
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Expenses Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              موردی با فیلترهای فعلی یافت نشد.
            </p>
            {!isReadOnlyVersion && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenManualAdd}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  ثبت اولین هزینه
                </button>
                <button
                  type="button"
                  onClick={onOpenExcelImport}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ورود از اکسل
                </button>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[920px] text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">نام هزینه</th>
                <th className="px-3 py-3 font-semibold">دسته و زیرمجموعه</th>
                <th className="px-3 py-3 font-semibold">مبلغ پایه</th>
                <th className="px-3 py-3 font-semibold">درصد مؤثر</th>
                <th className="px-3 py-3 font-semibold">مبلغ برآوردی</th>
                <th className="px-3 py-3 font-semibold">اختلاف مبلغی</th>
                <th className="px-3 py-3 font-semibold">نوع نرخ</th>
                {!isReadOnlyVersion && (
                  <th className="px-3 py-3 font-semibold text-left">عملیات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const rawExp = projectExpenses.find(
                  (e) => e.id === item.expenseId
                );
                const isEditingRate = editingOverrideId === item.expenseId;

                return (
                  <tr
                    key={item.expenseId}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                        تاریخ: {formatJalaliDisplay(item.dateJalali)}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-slate-700">
                      <span>{item.categoryName}</span>
                      {item.subcategory && (
                        <>
                          <span className="mx-1.5 text-slate-400">·</span>
                          <span className="text-slate-500">
                            {item.subcategory}
                          </span>
                        </>
                      )}
                    </td>

                    <td className="px-3 py-3 font-medium text-slate-900 tabular-nums">
                      {formatCurrencyValue(item.baseAmount, activeProject.currency)}
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      {isEditingRate && !isReadOnlyVersion ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={overrideInputRaw}
                            onChange={(e) =>
                              setOverrideInputRaw(normalizeDigits(e.target.value))
                            }
                            aria-label={`درصد مستقل برای ${item.title}`}
                            className="w-16 rounded border border-sky-700 px-2 py-1 text-xs font-bold tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveOverride(item.expenseId)}
                            className="rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white"
                          >
                            ثبت
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingOverrideId(null)}
                            className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600"
                          >
                            لغو
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              item.effectivePercent > 0
                                ? 'text-red-700'
                                : item.effectivePercent < 0
                                  ? 'text-emerald-700'
                                  : 'text-slate-700'
                            }`}
                          >
                            {formatPercentFa(item.effectivePercent, {
                              showPlus: true,
                            })}
                          </span>
                          {!isReadOnlyVersion && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOverrideId(item.expenseId);
                                setOverrideInputRaw(
                                  item.rateSource === 'INDEPENDENT' &&
                                    item.overridePercent !== null
                                    ? String(item.overridePercent)
                                    : String(item.effectivePercent)
                                );
                              }}
                              aria-label={`تنظیم درصد مستقل برای ${item.title}`}
                              className="text-[11px] font-medium text-sky-800 hover:underline"
                            >
                              تغییر
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 font-bold text-slate-900 tabular-nums">
                      {formatCurrencyValue(
                        item.estimatedAmount,
                        activeProject.currency
                      )}
                    </td>

                    <td
                      className={`px-3 py-3 font-medium tabular-nums ${
                        item.diffFromBaseAmount > 0
                          ? 'text-red-700'
                          : item.diffFromBaseAmount < 0
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {formatNumberFa(item.diffFromBaseAmount, {
                        showPlus: true,
                      })}
                    </td>

                    <td className="px-3 py-3">
                      {item.rateSource === 'INDEPENDENT' ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-amber-800">
                            درصد مستقل
                          </span>
                          {!isReadOnlyVersion && (
                            <button
                              type="button"
                              onClick={() => handleClearOverride(item.expenseId)}
                              aria-label={`حذف درصد مستقل ${item.title} و بازگشت به دسته`}
                              title="حذف درصد مستقل و بازگشت به نرخ دسته"
                              className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-950 underline"
                            >
                              <RotateCcw className="h-3 w-3" />
                              حذف مستقل
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">پیروی از دسته</span>
                      )}
                    </td>

                    {!isReadOnlyVersion && (
                      <td className="px-3 py-3 text-left">
                        <div className="inline-flex items-center gap-1">
                          {rawExp && (
                            <button
                              type="button"
                              onClick={() => onOpenManualEdit(rawExp)}
                              aria-label={`ویرایش هزینه ${item.title}`}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {rawExp && (
                            <button
                              type="button"
                              onClick={() => setExpenseToDelete(rawExp)}
                              aria-label={`حذف هزینه ${item.title}`}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={Boolean(expenseToDelete)}
        title="تأیید حذف هزینه"
        description={
          expenseToDelete
            ? `آیا از حذف هزینهٔ «${expenseToDelete.title}» از هزینه‌های پایهٔ این پروژه مطمئن هستید؟ نسخه‌های قیمت‌گذاری ذخیره‌شدهٔ قبلی دست‌نخورده باقی می‌مانند.`
            : ''
        }
        confirmLabel="حذف هزینه"
        onCancel={() => setExpenseToDelete(null)}
        onConfirm={async () => {
          if (!expenseToDelete) return;
          await deleteExpense(expenseToDelete.id);
          setExpenseToDelete(null);
        }}
      />
    </div>
  );
}
