'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ImageOff,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type {
  CategoryItem,
  ExpenseImageAttachment,
  ExpenseItem,
  ExpenseUnitType,
  ProjectCurrency,
  WeightUnit,
} from '../types/app';
import {
  computeDetailedExpenseTotal,
  getUnitPriceFieldLabel,
  UNIT_TYPE_OPTIONS,
  WEIGHT_UNIT_OPTIONS,
} from '../utils/detailedExpense';
import { getTodayJalali, normalizeDigits, parseJalaliDate } from '../utils/jalali';
import {
  formatCurrencyValue,
  formatNumberFa,
  parseStrictNumericInput,
} from '../utils/pricing';

interface DetailedExpenseSavePayload {
  categoryName: string;
  subcategory: string;
  tagId: number | null;
  dateJalali: string;
  title: string;
  entryMode: 'detailed';
  unitType: ExpenseUnitType;
  quantity: number | null;
  itemCount?: number | null;
  weightUnit: WeightUnit | null;
  unitPrice: number;
  baseAmount: number;
  description: string;
  images: ExpenseImageAttachment[];
}

interface DetailedExpenseModalProps {
  open: boolean;
  projectId: number | null;
  categories: CategoryItem[];
  currency: ProjectCurrency;
  initialExpense?: ExpenseItem | null;
  initialTagId?: number | null;
  onClose: () => void;
  onSave: (data: DetailedExpenseSavePayload) => Promise<boolean>;
}

const MAX_IMAGES = 8;

export function DetailedExpenseModal({
  open,
  projectId,
  categories,
  currency,
  initialExpense,
  initialTagId = null,
  onClose,
  onSave,
}: DetailedExpenseModalProps) {
  const { getAuthHeaders } = useAuth();
  const { projectTags, createTag } = useWorkspace();
  const [title, setTitle] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [tagId, setTagId] = useState<number | null>(null);
  const [quickTagOpen, setQuickTagOpen] = useState(false);
  const [quickTagName, setQuickTagName] = useState('');
  const [quickTagSaving, setQuickTagSaving] = useState(false);
  const [quickTagError, setQuickTagError] = useState<string | null>(null);
  const [dateJalali, setDateJalali] = useState('');
  const [unitType, setUnitType] = useState<ExpenseUnitType>('weight');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('ton');
  const [quantityRaw, setQuantityRaw] = useState('');
  const [itemCountRaw, setItemCountRaw] = useState('');
  const [unitPriceRaw, setUnitPriceRaw] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ExpenseImageAttachment[]>([]);

  const [s3Configured, setS3Configured] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedThumbKeys, setFailedThumbKeys] = useState<Record<string, boolean>>({});

  const [suggesting, setSuggesting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Track newly uploaded keys during this modal session so cancelling cleans up orphaned S3 objects
  const sessionUploadedKeysRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    sessionUploadedKeysRef.current = [];
    setFailedThumbKeys({});
    setUploadError(null);
    setAiError(null);
    setError(null);
    setQuickTagOpen(false);
    setQuickTagName('');
    setQuickTagError(null);

    if (initialExpense) {
      setTitle(initialExpense.title);
      setCategoryName(initialExpense.categoryName);
      setSubcategory(initialExpense.subcategory);
      setTagId(typeof initialExpense.tagId === 'number' ? initialExpense.tagId : null);
      setDateJalali(initialExpense.dateJalali);
      setUnitType(initialExpense.unitType ?? 'service');
      setWeightUnit(initialExpense.weightUnit ?? 'ton');
      setQuantityRaw(
        typeof initialExpense.quantity === 'number'
          ? String(initialExpense.quantity)
          : ''
      );
      setItemCountRaw(
        typeof initialExpense.itemCount === 'number'
          ? String(initialExpense.itemCount)
          : ''
      );
      setUnitPriceRaw(
        typeof initialExpense.unitPrice === 'number'
          ? String(initialExpense.unitPrice)
          : String(initialExpense.baseAmount)
      );
      setDescription(initialExpense.description ?? '');
      setImages(Array.isArray(initialExpense.images) ? initialExpense.images : []);
    } else {
      setTitle('');
      setCategoryName(categories[0]?.name ?? 'مواد و مصالح');
      setSubcategory('');
      setTagId(typeof initialTagId === 'number' ? initialTagId : null);
      setDateJalali(getTodayJalali());
      setUnitType('weight');
      setWeightUnit('ton');
      setQuantityRaw('');
      setItemCountRaw('');
      setUnitPriceRaw('');
      setDescription('');
      setImages([]);
    }
  }, [open, initialExpense, initialTagId, categories]);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/uploads?status=1`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.configured === 'boolean') {
          setS3Configured(data.configured);
        }
      })
      .catch(() => {
        if (!cancelled) setS3Configured(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, getAuthHeaders]);

  if (!open) return null;

  const selectedCat = categories.find((c) => c.name === categoryName);
  const availableSubs = selectedCat?.subcategories ?? [];

  const parsedQuantity = quantityRaw.trim()
    ? parseStrictNumericInput(quantityRaw)
    : null;
  const parsedItemCount = itemCountRaw.trim()
    ? parseStrictNumericInput(itemCountRaw)
    : null;
  const parsedUnitPrice = unitPriceRaw.trim()
    ? parseStrictNumericInput(unitPriceRaw)
    : null;

  const liveTotal =
    parsedUnitPrice !== null
      ? computeDetailedExpenseTotal({
          unitType,
          quantity: parsedQuantity,
          unitPrice: parsedUnitPrice,
        })
      : null;

  const handleCloseWithCleanup = () => {
    const unsavedKeys = [...sessionUploadedKeysRef.current];
    sessionUploadedKeysRef.current = [];
    if (projectId && unsavedKeys.length > 0) {
      unsavedKeys.forEach((key) => {
        fetch(`/api/projects/${projectId}/uploads`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ key }),
        }).catch(() => {});
      });
    }
    onClose();
  };

  const handleSuggestCategory = async () => {
    if (!title.trim()) {
      setAiError('ابتدا عنوان هزینه را وارد کنید.');
      return;
    }
    setAiError(null);
    setSuggesting(true);
    try {
      const res = await fetch('/api/ai/suggest-category', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: title.trim(),
          categoriesList: categories.map((c) => ({
            name: c.name,
            subcategories: c.subcategories,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'پیشنهاد هوشمند انجام نشد.');
      } else {
        if (data.categoryName) setCategoryName(data.categoryName);
        if (data.subcategory) setSubcategory(data.subcategory);
      }
    } catch {
      setAiError('خطا در ارتباط با سرویس پیشنهاد دسته‌بندی.');
    } finally {
      setSuggesting(false);
    }
  };

  const handleQuickCreateTag = async () => {
    const trimmed = quickTagName.trim();
    if (trimmed.length < 2) {
      setQuickTagError('نام برچسب باید حداقل ۲ کاراکتر باشد.');
      return;
    }
    setQuickTagError(null);
    setQuickTagSaving(true);
    const created = await createTag(trimmed, 0);
    setQuickTagSaving(false);
    if (created) {
      setTagId(created.id);
      setQuickTagName('');
      setQuickTagOpen(false);
    } else {
      setQuickTagError('ایجاد برچسب انجام نشد (ممکن است نام تکراری باشد).');
    }
  };

  const handleFilesSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0 || !projectId) return;
    setUploadError(null);

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setUploadError(`حداکثر ${formatNumberFa(MAX_IMAGES)} تصویر برای هر ردیف مجاز است.`);
      return;
    }

    const files = Array.from(filesList).slice(0, remainingSlots);
    setUploading(true);

    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setUploadError(`حجم فایل «${file.name}» بیش از ۵ مگابایت است.`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/projects/${projectId}/uploads`, {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(data.error || 'بارگذاری تصویر در فضای S3 انجام نشد.');
          if (res.status === 503) {
            setS3Configured(false);
            break;
          }
          continue;
        }
        if (data.image) {
          const uploaded = data.image as ExpenseImageAttachment;
          sessionUploadedKeysRef.current.push(uploaded.key);
          setImages((prev) => [...prev, uploaded]);
        }
      }
    } catch {
      setUploadError('خطا در برقراری ارتباط برای بارگذاری تصویر.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (targetKey: string) => {
    setImages((prev) => prev.filter((img) => img.key !== targetKey));
    // If it was uploaded during this open modal session, remove it immediately from S3
    const idx = sessionUploadedKeysRef.current.indexOf(targetKey);
    if (idx >= 0 && projectId) {
      sessionUploadedKeysRef.current.splice(idx, 1);
      fetch(`/api/projects/${projectId}/uploads`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ key: targetKey }),
      }).catch(() => {});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('عنوان هزینه یا قلم خرید الزامی است.');
      return;
    }

    if (!categoryName.trim()) {
      setError('انتخاب دسته اصلی الزامی است.');
      return;
    }

    const dateCheck = parseJalaliDate(dateJalali);
    if (!dateCheck.valid) {
      setError(dateCheck.error ?? 'تاریخ شمسی نامعتبر است.');
      return;
    }

    if (parsedUnitPrice === null || parsedUnitPrice < 0) {
      setError(
        unitType === 'service'
          ? 'مبلغ کل خدمت باید عددی معتبر و غیرمنفی باشد.'
          : 'قیمت واحد باید عددی معتبر و غیرمنفی باشد.'
      );
      return;
    }

    let finalQty: number | null = null;
    if (quantityRaw.trim()) {
      if (parsedQuantity === null || parsedQuantity <= 0) {
        setError('مقدار / تعداد باید عددی مثبت و بزرگ‌تر از صفر باشد.');
        return;
      }
      finalQty = parsedQuantity;
    }

    if (unitType === 'weight' && finalQty === null) {
      setError('برای واحد وزنی، وارد کردن مقدار وزن الزامی است.');
      return;
    }
    if (unitType === 'count' && finalQty === null) {
      setError('برای واحد تعدادی، وارد کردن تعداد الزامی است.');
      return;
    }
    if (unitType === 'meter' && finalQty === null) {
      setError('برای واحد متراژ، وارد کردن متراژ الزامی است.');
      return;
    }

    let finalItemCount: number | null = null;
    if (unitType === 'weight' && itemCountRaw.trim()) {
      if (parsedItemCount === null || parsedItemCount <= 0) {
        setError('تعداد اختیاری باید عددی مثبت و بزرگ‌تر از صفر باشد.');
        return;
      }
      finalItemCount = parsedItemCount;
    }

    const computedTotal = computeDetailedExpenseTotal({
      unitType,
      quantity: finalQty,
      unitPrice: parsedUnitPrice,
    });

    if (computedTotal === null) {
      setError('محاسبهٔ مبلغ کل با مقادیر واردشده امکان‌پذیر نیست.');
      return;
    }

    setSaving(true);
    const ok = await onSave({
      categoryName: categoryName.trim(),
      subcategory: subcategory.trim(),
      tagId,
      dateJalali: dateCheck.normalized!,
      title: title.trim(),
      entryMode: 'detailed',
      unitType,
      quantity: finalQty,
      itemCount: finalItemCount,
      weightUnit: unitType === 'weight' ? weightUnit : null,
      unitPrice: parsedUnitPrice,
      baseAmount: computedTotal,
      description: description.trim(),
      images,
    });
    setSaving(false);

    if (ok) {
      sessionUploadedKeysRef.current = [];
      onClose();
    } else {
      setError('ذخیرهٔ هزینهٔ جزئی با خطا مواجه شد.');
    }
  };

  const quantityLabel =
    unitType === 'weight'
      ? `مقدار وزن (${weightUnit === 'ton' ? 'تن' : 'کیلوگرم'})`
      : unitType === 'count'
        ? 'تعداد'
        : unitType === 'meter'
          ? 'متراژ (متر)'
          : 'تعداد (اختیاری)';

  const quantityPlaceholder =
    unitType === 'weight'
      ? weightUnit === 'ton'
        ? 'مثال: ۱۲٫۵'
        : 'مثال: ۵۰۰'
      : unitType === 'count'
        ? 'مثال: ۴۰'
        : unitType === 'meter'
          ? 'مثال: ۱۲۰'
          : 'اختیاری (مثال: ۱)';

  const unitPriceLabel = `${getUnitPriceFieldLabel(
    unitType,
    unitType === 'weight' ? weightUnit : null
  )} (${currency === 'تعیین‌نشده' ? 'مبلغ عددی' : currency})`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detailed-expense-modal-title"
    >
      <div className="my-6 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2
              id="detailed-expense-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              {initialExpense ? 'ویرایش هزینهٔ جزئی' : 'ثبت هزینهٔ جزئی جدید'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              مبلغ کل به‌صورت خودکار محاسبه شده و در گزارش کلی دسته‌بندی‌ها و داشبورد پروژه تجمیع می‌شود.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseWithCleanup}
            aria-label="بستن فرم ثبت هزینه جزئی"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Row 1: Title + Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="det-title"
                  className="block text-sm font-medium text-slate-700"
                >
                  عنوان هزینه / کالا / خدمت <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleSuggestCategory}
                  disabled={suggesting}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 hover:text-sky-950 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {suggesting ? 'در حال پیشنهاد...' : 'پیشنهاد دسته‌بندی'}
                </button>
              </div>
              <input
                id="det-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: میلگرد ۱۶ اصفهان، بتن آماده، اجرت اسکلت‌بندی"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
              {aiError && (
                <p className="mt-1 text-xs text-amber-700">{aiError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="det-date"
                className="block text-sm font-medium text-slate-700"
              >
                تاریخ (شمسی) <span className="text-red-600">*</span>
              </label>
              <input
                id="det-date"
                type="text"
                value={dateJalali}
                onChange={(e) => setDateJalali(normalizeDigits(e.target.value))}
                placeholder="۱۴۰۵/۰۸/۱۰"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>
          </div>

          {/* Row 2: Category & Subcategory */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="det-cat"
                className="block text-sm font-medium text-slate-700"
              >
                دسته اصلی <span className="text-red-600">*</span>
              </label>
              <select
                id="det-cat"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setSubcategory('');
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              >
                {categoryName &&
                  !categories.some((cat) => cat.name === categoryName) && (
                    <option value={categoryName}>{categoryName}</option>
                  )}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="det-sub"
                className="block text-sm font-medium text-slate-700"
              >
                زیردسته / بخش
              </label>
              <input
                id="det-sub"
                type="text"
                list="det-sub-options"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="انتخاب یا نوشتن زیردسته (اختیاری)"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
              <datalist id="det-sub-options">
                {availableSubs.map((sub) => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 2.5: Tag Selector + Quick Create */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="det-tag"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800"
              >
                <Tag className="h-3.5 w-3.5 text-slate-600" />
                برچسب تجمیعی (اختیاری)
              </label>
              <button
                type="button"
                onClick={() => {
                  setQuickTagOpen((v) => !v);
                  setQuickTagError(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-800 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {quickTagOpen ? 'بستن ایجاد سریع' : 'ایجاد برچسب جدید'}
              </button>
            </div>

            <select
              id="det-tag"
              value={tagId !== null ? String(tagId) : ''}
              onChange={(e) =>
                setTagId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-sky-700 focus:outline-none"
            >
              <option value="">بدون برچسب (نمایش به‌صورت ردیف مجزا)</option>
              {projectTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {quickTagOpen && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickTagName}
                    onChange={(e) => setQuickTagName(e.target.value)}
                    placeholder="نام برچسب جدید (مثلاً میلگرد ۱۶ یا بتن آماده)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={quickTagSaving}
                    onClick={handleQuickCreateTag}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {quickTagSaving ? 'در حال ثبت...' : 'ثبت برچسب'}
                  </button>
                </div>
                {quickTagError && (
                  <p className="text-[11px] text-red-700">{quickTagError}</p>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              همهٔ خریدها و خدماتی که برچسب یکسان دارند در جدول جزئیات زیر یک ردیف بازشو کنار هم قرار می‌گیرند.
            </p>
          </div>

          {/* Row 3: Unit Type Selector */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">
                نوع واحد اندازه‌گیری <span className="text-red-600">*</span>
              </span>
              <span className="text-xs text-slate-500">
                {unitType === 'service'
                  ? 'در حالت خدمات، قیمت واردشده به‌عنوان مبلغ کل ثبت می‌شود.'
                  : 'مبلغ کل به‌طور خودکار از ضرب مقدار در قیمت واحد محاسبه می‌شود.'}
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="انتخاب واحد اندازه‌گیری"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {UNIT_TYPE_OPTIONS.map((opt) => {
                const active = unitType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setUnitType(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Weight Unit Selector (only when unitType === 'weight') */}
            {unitType === 'weight' && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-xs font-medium text-slate-700">
                  واحد وزن:
                </span>
                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {WEIGHT_UNIT_OPTIONS.map((wu) => {
                    const active = weightUnit === wu.value;
                    return (
                      <button
                        key={wu.value}
                        type="button"
                        onClick={() => setWeightUnit(wu.value)}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {wu.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity, Optional Weight Item Count & Unit Price Inputs */}
            <div
              className={`grid grid-cols-1 gap-4 pt-1 ${
                unitType === 'weight' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              }`}
            >
              <div>
                <label
                  htmlFor="det-quantity"
                  className="block text-sm font-medium text-slate-700"
                >
                  {quantityLabel}{' '}
                  {unitType !== 'service' && (
                    <span className="text-red-600">*</span>
                  )}
                </label>
                <input
                  id="det-quantity"
                  type="text"
                  inputMode="decimal"
                  value={quantityRaw}
                  onChange={(e) =>
                    setQuantityRaw(normalizeDigits(e.target.value))
                  }
                  placeholder={quantityPlaceholder}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
                {unitType === 'service' && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    اختیاری؛ فقط برای ثبت تعداد دفعات و تأثیری بر مبلغ کل ندارد.
                  </p>
                )}
              </div>

              {unitType === 'weight' && (
                <div>
                  <label
                    htmlFor="det-weight-item-count"
                    className="block text-sm font-medium text-slate-700"
                  >
                    تعداد (اختیاری)
                  </label>
                  <input
                    id="det-weight-item-count"
                    type="text"
                    inputMode="decimal"
                    value={itemCountRaw}
                    onChange={(e) =>
                      setItemCountRaw(normalizeDigits(e.target.value))
                    }
                    placeholder="اختیاری (مثال: ۲۰)"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    اختیاری؛ برای ثبت تعداد شاخه، کیسه یا بسته (تأثیری بر مبلغ کل ندارد).
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="det-unit-price"
                  className="block text-sm font-medium text-slate-700"
                >
                  {unitPriceLabel} <span className="text-red-600">*</span>
                </label>
                <input
                  id="det-unit-price"
                  type="text"
                  inputMode="decimal"
                  value={unitPriceRaw}
                  onChange={(e) =>
                    setUnitPriceRaw(normalizeDigits(e.target.value))
                  }
                  placeholder={
                    unitType === 'service'
                      ? 'مثال: ۸۵۰۰۰۰۰۰'
                      : 'مثال: ۳۸۰۰۰۰۰۰'
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
                {parsedUnitPrice !== null && (
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {formatCurrencyValue(parsedUnitPrice, currency)}
                  </p>
                )}
              </div>
            </div>

            {/* Live Computed Total Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm tabular-nums">
              <div className="text-xs font-medium text-sky-900">
                {unitType === 'service'
                  ? 'مبلغ کل خدمت (مبنای محاسبه در گزارش‌ها):'
                  : 'مبلغ کل محاسبه‌شده (مقدار × قیمت واحد):'}
              </div>
              <div className="text-base font-extrabold text-sky-950">
                {liveTotal !== null
                  ? formatCurrencyValue(liveTotal, currency)
                  : '—'}
              </div>
            </div>
          </div>

          {/* Row 4: Description */}
          <div>
            <label
              htmlFor="det-desc"
              className="block text-sm font-medium text-slate-700"
            >
              توضیحات تکمیلی
            </label>
            <textarea
              id="det-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مشخصات فنی، نام فروشنده یا پیمانکار، شماره فاکتور یا محل مصرف..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
            />
          </div>

          {/* Row 5: S3 Image Attachments */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">
                تصاویر فاکتور و مستندات (ذخیره‌سازی S3)
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {formatNumberFa(images.length)} از {formatNumberFa(MAX_IMAGES)} تصویر
              </span>
            </div>

            {s3Configured === false && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-950">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  اتصال فضای ذخیره‌سازی S3 هنوز در متغیرهای محیطی سرور تنظیم نشده است. می‌توانید این هزینه را بدون تصویر ثبت کنید یا پس از تنظیم کلیدهای S3، تصاویر فاکتور را اضافه نمایید.
                </div>
              </div>
            )}

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                {uploadError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                id="det-images-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || images.length >= MAX_IMAGES}
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="sr-only"
              />
              <label
                htmlFor="det-images-input"
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 ${
                  uploading || images.length >= MAX_IMAGES
                    ? 'pointer-events-none opacity-50'
                    : ''
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? 'در حال بارگذاری در S3...' : 'انتخاب و بارگذاری تصویر'}
              </label>
              <span className="text-xs text-slate-500">
                فرمت‌های مجاز: JPG، PNG، WebP (حداکثر ۵ مگابایت برای هر فایل)
              </span>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((img) => (
                  <div
                    key={img.key}
                    className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <div className="aspect-square w-full bg-slate-100">
                      {failedThumbKeys[img.key] ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-slate-400">
                          <ImageOff className="h-5 w-5" />
                          <span className="truncate text-[10px] max-w-full">
                            {img.fileName}
                          </span>
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
                    </div>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px] text-slate-600">
                      <span className="truncate" title={img.fileName}>
                        {img.fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.key)}
                        aria-label={`حذف تصویر ${img.fileName}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleCloseWithCleanup}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {saving
                ? 'در حال ذخیره...'
                : initialExpense
                  ? 'ذخیرهٔ تغییرات'
                  : 'ثبت هزینهٔ جزئی'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
