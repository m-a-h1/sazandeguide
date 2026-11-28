'use client';

import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Edit3,
  Filter,
  Image as ImageIcon,
  ImageOff,
  LayoutDashboard,
  Layers,
  Plus,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type {
  AppSection,
  ExpenseImageAttachment,
  ExpenseItem,
  ExpenseUnitType,
} from '../types/app';
import {
  aggregateDetailedCategorySummaries,
  formatAggregatedWeight,
  formatDetailedQuantity,
  getUnitTypeLabel,
  groupDetailedExpensesByTag,
  isDetailedExpense,
  UNIT_TYPE_OPTIONS,
} from '../utils/detailedExpense';
import {
  formatJalaliDisplay,
  isJalaliInRange,
  normalizeDigits,
} from '../utils/jalali';
import {
  formatCurrencyValue,
  formatNumberFa,
  formatPercentFa,
} from '../utils/pricing';
import { ConfirmModal } from './ConfirmModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { TagManagerModal } from './TagManagerModal';

interface DetailedExpensesViewProps {
  onOpenDetailedAdd: (defaultTagId?: number | null) => void;
  onOpenDetailedEdit: (expense: ExpenseItem) => void;
  onNavigate: (section: AppSection) => void;
}

export function DetailedExpensesView({
  onOpenDetailedAdd,
  onOpenDetailedEdit,
  onNavigate,
}: DetailedExpensesViewProps) {
  const {
    activeProject,
    projectCategories,
    projectExpenses,
    projectTags,
    deleteExpense,
  } = useWorkspace();

  const [summaryScope, setSummaryScope] = useState<'detailed' | 'all'>(
    'detailed'
  );
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedTagIds, setExpandedTagIds] = useState<Record<number, boolean>>({});
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('همه');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('همه');
  const [filterTag, setFilterTag] = useState<string>('همه');
  const [filterUnitType, setFilterUnitType] = useState<
    'همه' | ExpenseUnitType
  >('همه');
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(
    null
  );
  const [lightboxState, setLightboxState] = useState<{
    images: ExpenseImageAttachment[];
    index: number;
    title: string;
    dateJalali: string;
    categoryName: string;
    amount: number;
  } | null>(null);
  const [failedThumbKeys, setFailedThumbKeys] = useState<
    Record<string, boolean>
  >({});

  const detailedExpenses = useMemo(
    () =>
      projectExpenses
        .filter((e) => isDetailedExpense(e))
        .sort((a, b) => b.id - a.id),
    [projectExpenses]
  );

  const categorySummary = useMemo(
    () =>
      aggregateDetailedCategorySummaries(projectExpenses, {
        includeGeneral: summaryScope === 'all',
      }),
    [projectExpenses, summaryScope]
  );

  const subcategoriesForFilter = useMemo(() => {
    const subs = new Set<string>();
    for (const item of detailedExpenses) {
      if (filterCategory === 'همه' || item.categoryName === filterCategory) {
        if (item.subcategory) subs.add(item.subcategory);
      }
    }
    return Array.from(subs);
  }, [detailedExpenses, filterCategory]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return detailedExpenses.filter((item) => {
      if (q) {
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = (item.description ?? '').toLowerCase().includes(q);
        const matchCat = item.categoryName.toLowerCase().includes(q);
        const matchSub = item.subcategory.toLowerCase().includes(q);
        const matchTag = (item.tagName ?? '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat && !matchSub && !matchTag) {
          return false;
        }
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
      if (filterTag === 'untagged') {
        if (typeof item.tagId === 'number' && item.tagId > 0) return false;
      } else if (filterTag !== 'همه') {
        if (item.tagId !== Number(filterTag)) return false;
      }
      if (filterUnitType !== 'همه' && item.unitType !== filterUnitType) {
        return false;
      }
      if (
        onlyWithPhotos &&
        (!Array.isArray(item.images) || item.images.length === 0)
      ) {
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
    detailedExpenses,
    searchQuery,
    filterCategory,
    filterSubcategory,
    filterTag,
    filterUnitType,
    onlyWithPhotos,
    dateFrom,
    dateTo,
  ]);

  const groupedByTag = useMemo(() => {
    const grouped = groupDetailedExpensesByTag(
      filteredItems,
      projectTags,
      activeProject?.currency ?? 'تعیین‌نشده'
    );
    return {
      ...grouped,
      tagGroups: [...grouped.tagGroups].sort(
        (a, b) => b.totalBaseAmount - a.totalBaseAmount
      ),
    };
  }, [filteredItems, projectTags, activeProject?.currency]);

  const filteredTotalAmount = useMemo(
    () => filteredItems.reduce((sum, item) => sum + item.baseAmount, 0),
    [filteredItems]
  );

  const filteredPhotoCount = useMemo(
    () =>
      filteredItems.reduce(
        (sum, item) => sum + (Array.isArray(item.images) ? item.images.length : 0),
        0
      ),
    [filteredItems]
  );

  if (!activeProject) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
        <h2 className="mt-3 text-base font-bold text-slate-900">
          پروژه‌ای انتخاب نشده است
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          برای ثبت جزئیات هزینه‌ها، ابتدا یک پروژه انتخاب یا ایجاد کنید.
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

  const hasActiveFilters = Boolean(
    searchQuery ||
      filterCategory !== 'همه' ||
      filterSubcategory !== 'همه' ||
      filterTag !== 'همه' ||
      filterUnitType !== 'همه' ||
      onlyWithPhotos ||
      dateFrom ||
      dateTo
  );

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCategory('همه');
    setFilterSubcategory('همه');
    setFilterTag('همه');
    setFilterUnitType('همه');
    setOnlyWithPhotos(false);
    setDateFrom('');
    setDateTo('');
  };

  const toggleTagExpanded = (tagId: number) => {
    setExpandedTagIds((prev) => ({
      ...prev,
      [tagId]: !prev[tagId],
    }));
  };

  const renderExpenseRow = (item: ExpenseItem, indented: boolean) => {
    const imgs = Array.isArray(item.images) ? item.images : [];

    return (
      <tr
        key={item.id}
        className={`transition-colors align-top ${
          indented
            ? 'bg-slate-50/70 hover:bg-slate-100/70'
            : 'hover:bg-slate-50/80'
        }`}
      >
        <td
          className={`max-w-[300px] py-3 ${
            indented
              ? 'pr-9 pl-4 border-r-2 border-r-sky-700'
              : 'px-4'
          }`}
        >
          <div className="font-semibold text-slate-900">{item.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
            <span>{formatJalaliDisplay(item.dateJalali)}</span>
            {!indented && item.tagName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-sky-900">
                  برچسب: {item.tagName}
                </span>
              </>
            )}
          </div>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-600">
              {item.description}
            </p>
          )}
        </td>

        <td className="px-3 py-3 text-slate-700">
          <div className="font-medium text-slate-800">{item.categoryName}</div>
          {item.subcategory && (
            <div className="mt-0.5 text-[11px] text-slate-500">
              {item.subcategory}
            </div>
          )}
        </td>

        <td className="px-3 py-3 tabular-nums">
          <div className="font-semibold text-slate-900">
            {formatDetailedQuantity(item)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {getUnitTypeLabel(item.unitType)}
          </div>
        </td>

        <td className="px-3 py-3 text-slate-700 tabular-nums">
          {item.unitType === 'service' ? (
            <span className="text-slate-500">مبلغ کل خدمت</span>
          ) : typeof item.unitPrice === 'number' ? (
            formatCurrencyValue(item.unitPrice, activeProject.currency)
          ) : (
            '—'
          )}
        </td>

        <td className="px-3 py-3 font-bold text-slate-950 tabular-nums whitespace-nowrap">
          {formatCurrencyValue(item.baseAmount, activeProject.currency)}
        </td>

        <td className="px-3 py-3">
          {imgs.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <div className="flex items-center gap-1.5">
              {imgs.slice(0, 3).map((img, idx) => (
                <button
                  key={img.key}
                  type="button"
                  onClick={() =>
                    setLightboxState({
                      images: imgs,
                      index: idx,
                      title: item.title,
                      dateJalali: item.dateJalali,
                      categoryName: item.categoryName,
                      amount: item.baseAmount,
                    })
                  }
                  aria-label={`مشاهده تصویر ${formatNumberFa(idx + 1)} از ${item.title}`}
                  className="h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-100 hover:border-sky-600 shrink-0"
                >
                  {failedThumbKeys[img.key] ? (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <ImageOff className="h-3.5 w-3.5" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.url}
                      alt={img.fileName}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedThumbKeys((prev) => ({
                          ...prev,
                          [img.key]: true,
                        }))
                      }
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
              {imgs.length > 3 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightboxState({
                      images: imgs,
                      index: 3,
                      title: item.title,
                      dateJalali: item.dateJalali,
                      categoryName: item.categoryName,
                      amount: item.baseAmount,
                    })
                  }
                  className="text-[11px] font-semibold text-sky-800 hover:underline tabular-nums whitespace-nowrap"
                >
                  +{formatNumberFa(imgs.length - 3)}
                </button>
              )}
            </div>
          )}
        </td>

        <td className="px-3 py-3 text-left">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenDetailedEdit(item)}
              aria-label={`ویرایش هزینه جزئی ${item.title}`}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpenseToDelete(item)}
              aria-label={`حذف هزینه جزئی ${item.title}`}
              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            ثبت و گزارش جزئیات هزینه‌ها
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ثبت خریدها و خدمات بر اساس واحد (وزن، تعداد، متراژ، خدمات) به همراه تصاویر فاکتور و تجمیع اقلام مشابه زیر برچسب‌های قابل باز شدن.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setTagManagerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Tag className="h-4 w-4" />
            مدیریت برچسب‌ها ({formatNumberFa(projectTags.length)})
          </button>

          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <LayoutDashboard className="h-4 w-4" />
            گزارش کلی داشبورد
          </button>

          <button
            type="button"
            onClick={() => onOpenDetailedAdd(null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            ثبت هزینهٔ جزئی جدید
          </button>
        </div>
      </div>

      {/* Category Summary Roll-Up Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">
              گزارش تجمیعی هزینه‌ها بر اساس دسته‌بندی
            </h2>
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSummaryScope('detailed')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                summaryScope === 'detailed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              فقط ثبت‌های جزئی ({formatNumberFa(detailedExpenses.length)})
            </button>
            <button
              type="button"
              onClick={() => setSummaryScope('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                summaryScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              کل پروژه ({formatNumberFa(projectExpenses.length)})
            </button>
          </div>
        </div>

        {/* Top Summary KPI Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs tabular-nums">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-600">
            <span>
              جمع کل{' '}
              {summaryScope === 'detailed' ? 'ردیف‌های جزئی' : 'کل پروژه'}:{' '}
              <strong className="text-sm font-extrabold text-slate-950">
                {formatCurrencyValue(
                  categorySummary.totalAmount,
                  activeProject.currency
                )}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <span>
              تعداد اقلام:{' '}
              <strong className="text-slate-900">
                {formatNumberFa(categorySummary.totalEntries)} ردیف
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <span>
              تصاویر پیوست‌شده:{' '}
              <strong className="text-slate-900">
                {formatNumberFa(categorySummary.totalPhotos)} تصویر
              </strong>
            </span>
          </div>

          {filterCategory !== 'همه' && (
            <button
              type="button"
              onClick={() => {
                setFilterCategory('همه');
                setFilterSubcategory('همه');
              }}
              className="text-xs font-semibold text-sky-800 hover:underline whitespace-nowrap shrink-0"
            >
              نمایش همهٔ دسته‌ها
            </button>
          )}
        </div>

        {/* Category Cards Grid */}
        {categorySummary.categories.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            هنوز ردیفی در این نما ثبت نشده است. با ثبت اولین هزینهٔ جزئی، جمع هر دسته‌بندی به‌طور خودکار اینجا نمایش داده می‌شود.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categorySummary.categories.map((cat) => {
              const isSelected = filterCategory === cat.categoryName;
              const unitHints: string[] = [];
              if (cat.totalWeightKg > 0) {
                unitHints.push(formatAggregatedWeight(cat.totalWeightKg));
              }
              if (cat.totalMeters > 0) {
                unitHints.push(
                  `${formatNumberFa(cat.totalMeters, { maxDecimals: 2 })} متر`
                );
              }
              if (cat.totalCountItems > 0) {
                unitHints.push(
                  `${formatNumberFa(cat.totalCountItems, { maxDecimals: 2 })} عدد`
                );
              }
              if (cat.serviceCount > 0) {
                unitHints.push(`${formatNumberFa(cat.serviceCount)} خدمت`);
              }

              return (
                <button
                  key={cat.categoryName}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setFilterCategory('همه');
                      setFilterSubcategory('همه');
                    } else {
                      setFilterCategory(cat.categoryName);
                      setFilterSubcategory('همه');
                    }
                  }}
                  className={`flex flex-col justify-between rounded-lg border p-4 text-right transition-colors ${
                    isSelected
                      ? 'border-sky-700 bg-sky-50/70'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-full">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-900">
                        {cat.categoryName}
                      </span>
                      <span className="text-xs font-bold text-sky-900 tabular-nums shrink-0">
                        {formatPercentFa(cat.sharePercent)}
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className="h-full rounded-full bg-sky-800 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(2, cat.sharePercent)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2.5 text-sm font-extrabold text-slate-950 tabular-nums">
                      {formatCurrencyValue(
                        cat.totalAmount,
                        activeProject.currency
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 tabular-nums">
                    <span>{formatNumberFa(cat.entryCount)} ردیف</span>
                    {unitHints.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{unitHints.join(' / ')}</span>
                      </>
                    )}
                    {cat.photoCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatNumberFa(cat.photoCount)} تصویر</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Filter Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Unit Type Segmented Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFilterUnitType('همه')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filterUnitType === 'همه'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همهٔ واحدها
            </button>
            {UNIT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterUnitType(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  filterUnitType === opt.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View mode toggle: grouped by tag vs flat */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'grouped'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                گروه‌بندی برچسب‌ها
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'flat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                نمایش فهرست ساده
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOnlyWithPhotos((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                onlyWithPhotos
                  ? 'border-sky-700 bg-sky-50 text-sky-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              فقط دارای تصویر
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="det-search"
              className="block text-[11px] font-medium text-slate-600"
            >
              جست‌وجو در عنوان، توضیحات یا دسته
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="det-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجو در هزینه‌های جزئی..."
                className="w-full rounded-lg border border-slate-300 py-1.5 pr-9 pl-3 text-xs text-slate-900 focus:border-sky-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="det-filter-cat"
              className="block text-[11px] font-medium text-slate-600"
            >
              دسته اصلی
            </label>
            <select
              id="det-filter-cat"
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
              htmlFor="det-filter-sub"
              className="block text-[11px] font-medium text-slate-600"
            >
              زیردسته
            </label>
            <select
              id="det-filter-sub"
              value={filterSubcategory}
              onChange={(e) => setFilterSubcategory(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="همه">همهٔ زیردسته‌ها</option>
              {subcategoriesForFilter.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="det-filter-tag"
              className="block text-[11px] font-medium text-slate-600"
            >
              برچسب
            </label>
            <select
              id="det-filter-tag"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
            >
              <option value="همه">همهٔ برچسب‌ها</option>
              <option value="untagged">بدون برچسب</option>
              {projectTags.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="det-date-from"
              className="block text-[11px] font-medium text-slate-600"
            >
              از تاریخ شمسی
            </label>
            <input
              id="det-date-from"
              type="text"
              value={dateFrom}
              onChange={(e) => setDateFrom(normalizeDigits(e.target.value))}
              placeholder="۱۴۰۵/۰۱/۰۱"
              className="mt-1 w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="det-date-to"
              className="block text-[11px] font-medium text-slate-600"
            >
              تا تاریخ شمسی
            </label>
            <input
              id="det-date-to"
              type="text"
              value={dateTo}
              onChange={(e) => setDateTo(normalizeDigits(e.target.value))}
              placeholder="۱۴۰۵/۱۲/۲۹"
              className="mt-1 w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 tabular-nums"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <Filter className="h-3.5 w-3.5" />
              پاک‌کردن فیلترها
            </button>
          )}
        </div>

        {/* Filtered Subtotal Line */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs tabular-nums text-slate-600">
          <span>
            نمایش{' '}
            <strong className="text-slate-900">
              {formatNumberFa(filteredItems.length)}
            </strong>{' '}
            ردیف از {formatNumberFa(detailedExpenses.length)} هزینهٔ جزئی
            {viewMode === 'grouped' && groupedByTag.tagGroups.length > 0 && (
              <>
                {' · '}
                <strong className="text-slate-900">
                  {formatNumberFa(groupedByTag.tagGroups.length)}
                </strong>{' '}
                گروه برچسب
              </>
            )}
            {filteredPhotoCount > 0 && (
              <>
                {' · '}
                {formatNumberFa(filteredPhotoCount)} تصویر
              </>
            )}
          </span>
          <span>
            جمع ردیف‌های فیلترشده:{' '}
            <strong className="text-sky-900">
              {formatCurrencyValue(filteredTotalAmount, activeProject.currency)}
            </strong>
          </span>
        </div>
      </section>

      {/* Detailed Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {detailedExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-base font-bold text-slate-900">
              هنوز هزینهٔ جزئی برای این پروژه ثبت نشده است
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-6 text-slate-500">
              می‌توانید خرید مصالح (وزنی بر حسب کیلوگرم یا تن، تعدادی، متراژ) و هزینه‌های خدمات را به همراه توضیحات و تصاویر فاکتور ثبت کنید تا به‌صورت خودکار در گزارش کلی دسته‌بندی‌ها و داشبورد پروژه محاسبه شوند.
            </p>
            <button
              type="button"
              onClick={() => onOpenDetailedAdd(null)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              ثبت اولین هزینهٔ جزئی
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              هیچ هزینهٔ جزئی با فیلترهای انتخاب‌شده یافت نشد.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              پاک‌کردن فیلترها
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[980px] text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  {viewMode === 'grouped'
                    ? 'برچسب / عنوان، تاریخ و توضیحات'
                    : 'عنوان، تاریخ و توضیحات'}
                </th>
                <th className="px-3 py-3 font-semibold">دسته‌بندی</th>
                <th className="px-3 py-3 font-semibold">واحد و مقدار</th>
                <th className="px-3 py-3 font-semibold">قیمت واحد</th>
                <th className="px-3 py-3 font-semibold">مبلغ کل</th>
                <th className="px-3 py-3 font-semibold">تصاویر</th>
                <th className="px-3 py-3 font-semibold text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viewMode === 'flat' ? (
                filteredItems.map((item) => renderExpenseRow(item, false))
              ) : (
                <>
                  {groupedByTag.tagGroups.map((group) => {
                    const isExpanded = Boolean(expandedTagIds[group.tagId]);

                    return (
                      <React.Fragment key={`tag-group-${group.tagId}`}>
                        <tr className="bg-white transition-colors hover:bg-slate-50 align-top">
                          <td className="max-w-[320px] px-4 py-3.5">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'بستن' : 'باز کردن'} جزئیات برچسب ${group.tagName}`}
                              onClick={() => toggleTagExpanded(group.tagId)}
                              className="flex items-start gap-2 text-right font-bold text-slate-900 hover:text-sky-900"
                            >
                              {isExpanded ? (
                                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-sky-800" />
                              ) : (
                                <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                              )}
                              <span className="inline-flex items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5 shrink-0 text-sky-800" />
                                <span>{group.tagName}</span>
                              </span>
                            </button>
                            <div className="mt-1 pr-6 text-[11px] text-slate-500 tabular-nums">
                              {formatNumberFa(group.entryCount)} ردیف ثبت‌شده
                              {group.latestDateJalali && (
                                <>
                                  {' · '}
                                  آخرین ثبت:{' '}
                                  {formatJalaliDisplay(group.latestDateJalali)}
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3.5 text-slate-700 font-medium">
                            {group.categoriesLabel}
                          </td>

                          <td className="px-3 py-3.5 font-semibold text-slate-900 tabular-nums">
                            {group.quantitySummary}
                          </td>

                          <td className="px-3 py-3.5 text-slate-700 tabular-nums">
                            <div className="font-semibold text-slate-900">
                              {group.unitPriceSummary}
                            </div>
                            {group.entryCount > 1 &&
                              group.weightedPrice.averageBasePrice !== null && (
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  {group.weightedPrice.isQuantityWeighted
                                    ? 'میانگین وزنی بر اساس مقدار'
                                    : `میانگین ${formatNumberFa(group.entryCount)} ردیف`}
                                </div>
                              )}
                          </td>

                          <td className="px-3 py-3.5 font-extrabold text-slate-950 tabular-nums whitespace-nowrap">
                            {formatCurrencyValue(
                              group.totalBaseAmount,
                              activeProject.currency
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-slate-600 tabular-nums">
                            {group.photoCount > 0
                              ? `${formatNumberFa(group.photoCount)} تصویر`
                              : '—'}
                          </td>

                          <td className="px-3 py-3.5 text-left whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenDetailedAdd(group.tagId)}
                                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                <Plus className="h-3 w-3" />
                                افزودن ردیف
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleTagExpanded(group.tagId)}
                                className="text-[11px] font-semibold text-sky-800 hover:underline"
                              >
                                {isExpanded ? 'بستن' : 'مشاهده اقلام'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded &&
                          group.items.map((child) =>
                            renderExpenseRow(child, true)
                          )}
                      </React.Fragment>
                    );
                  })}

                  {groupedByTag.untaggedItems.length > 0 &&
                    groupedByTag.tagGroups.length > 0 && (
                      <tr className="bg-slate-50">
                        <td
                          colSpan={7}
                          className="px-4 py-2 text-[11px] font-bold text-slate-600 tabular-nums"
                        >
                          ردیف‌های بدون برچسب (
                          {formatNumberFa(groupedByTag.untaggedItems.length)}{' '}
                          ردیف)
                        </td>
                      </tr>
                    )}

                  {groupedByTag.untaggedItems.map((item) =>
                    renderExpenseRow(item, false)
                  )}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      <TagManagerModal
        open={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
      />

      <ConfirmModal
        open={Boolean(expenseToDelete)}
        title="تأیید حذف هزینهٔ جزئی"
        description={
          expenseToDelete
            ? `آیا از حذف «${expenseToDelete.title}» و تصاویر پیوست آن مطمئن هستید؟ مبلغ این ردیف از گزارش کلی پروژه نیز کسر خواهد شد.`
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

      <ImageLightboxModal
        open={Boolean(lightboxState)}
        images={lightboxState?.images ?? []}
        initialIndex={lightboxState?.index ?? 0}
        title={lightboxState?.title ?? ''}
        dateJalali={lightboxState?.dateJalali}
        categoryName={lightboxState?.categoryName}
        amount={lightboxState?.amount}
        currency={activeProject.currency}
        onClose={() => setLightboxState(null)}
      />
    </div>
  );
}
