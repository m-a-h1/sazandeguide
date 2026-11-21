'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { CategoryItem, ExpenseItem, ProjectCurrency } from '../types/app';
import { getTodayJalali, normalizeDigits, parseJalaliDate } from '../utils/jalali';
import { formatCurrencyValue, parseStrictNumericInput } from '../utils/pricing';

interface ManualExpenseModalProps {
  open: boolean;
  categories: CategoryItem[];
  currency: ProjectCurrency;
  initialExpense?: ExpenseItem | null;
  onClose: () => void;
  onSave: (data: {
    categoryName: string;
    subcategory: string;
    dateJalali: string;
    title: string;
    baseAmount: number;
  }) => Promise<boolean>;
}

export function ManualExpenseModal({
  open,
  categories,
  currency,
  initialExpense,
  onClose,
  onSave,
}: ManualExpenseModalProps) {
  const [categoryName, setCategoryName] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [dateJalali, setDateJalali] = useState('');
  const [title, setTitle] = useState('');
  const [baseAmountRaw, setBaseAmountRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialExpense) {
      setCategoryName(initialExpense.categoryName);
      setSubcategory(initialExpense.subcategory);
      setDateJalali(initialExpense.dateJalali);
      setTitle(initialExpense.title);
      setBaseAmountRaw(String(initialExpense.baseAmount));
    } else {
      setCategoryName(categories[0]?.name ?? 'مواد و مصالح');
      setSubcategory('');
      setDateJalali(getTodayJalali());
      setTitle('');
      setBaseAmountRaw('');
    }
    setError(null);
    setAiError(null);
  }, [open, initialExpense, categories]);

  if (!open) return null;

  const selectedCat = categories.find((c) => c.name === categoryName);
  const availableSubs = selectedCat?.subcategories ?? [];
  const parsedPreviewAmount = parseStrictNumericInput(baseAmountRaw);

  const handleSuggestCategory = async () => {
    if (!title.trim()) {
      setAiError('ابتدا نام هزینه را وارد کنید.');
      return;
    }
    setAiError(null);
    setSuggesting(true);
    try {
      const res = await fetch('/api/ai/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryName.trim()) {
      setError('انتخاب یا وارد کردن دسته اصلی الزامی است.');
      return;
    }

    const dateCheck = parseJalaliDate(dateJalali);
    if (!dateCheck.valid) {
      setError(dateCheck.error ?? 'تاریخ شمسی نامعتبر است.');
      return;
    }

    if (!title.trim()) {
      setError('نام هزینه الزامی است.');
      return;
    }

    const parsedAmount = parseStrictNumericInput(baseAmountRaw);
    if (parsedAmount === null || parsedAmount < 0) {
      setError('مبلغ پایه باید عددی معتبر و غیرمنفی باشد.');
      return;
    }

    setSaving(true);
    const ok = await onSave({
      categoryName: categoryName.trim(),
      subcategory: subcategory.trim(),
      dateJalali: dateCheck.normalized!,
      title: title.trim(),
      baseAmount: parsedAmount,
    });
    setSaving(false);

    if (ok) {
      onClose();
    } else {
      setError('ثبت هزینه با خطا مواجه شد.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-expense-title"
    >
      <div className="my-8 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 id="manual-expense-title" className="text-lg font-bold text-slate-900">
            {initialExpense ? 'ویرایش ردیف هزینه' : 'ثبت دستی هزینهٔ جدید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن فرم ثبت هزینه"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          فیلدهای این فرم دقیقاً منطبق با پنج ستون استاندارد فایل اکسل است.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Field 4 (placed ergonomically with AI suggest or exact order — let's keep exact 5 fields in clear order!) */}
          <div>
            <label
              htmlFor="exp-cat"
              className="block text-sm font-medium text-slate-700"
            >
              ۱. دسته اصلی <span className="text-red-600">*</span>
            </label>
            <select
              id="exp-cat"
              value={categoryName}
              onChange={(e) => {
                setCategoryName(e.target.value);
                setSubcategory('');
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="exp-sub"
              className="block text-sm font-medium text-slate-700"
            >
              ۲. زیردسته / بخش
            </label>
            <input
              id="exp-sub"
              type="text"
              list="exp-sub-options"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="انتخاب از فهرست یا نوشتن زیردستهٔ جدید (اختیاری)"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
            />
            <datalist id="exp-sub-options">
              {availableSubs.map((sub) => (
                <option key={sub} value={sub} />
              ))}
            </datalist>
          </div>

          <div>
            <label
              htmlFor="exp-date"
              className="block text-sm font-medium text-slate-700"
            >
              ۳. تاریخ هزینه به شمسی <span className="text-red-600">*</span>
            </label>
            <input
              id="exp-date"
              type="text"
              value={dateJalali}
              onChange={(e) => setDateJalali(normalizeDigits(e.target.value))}
              placeholder="۱۴۰۵/۰۷/۲۷"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              قالب مجاز: سال/ماه/روز شمسی با ۴ رقم سال (مثال: ۱۴۰۵/۰۷/۲۷)
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="exp-title"
                className="block text-sm font-medium text-slate-700"
              >
                ۴. نام هزینه <span className="text-red-600">*</span>
              </label>
              <button
                type="button"
                onClick={handleSuggestCategory}
                disabled={suggesting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-800 hover:text-sky-950 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {suggesting ? 'در حال پیشنهاد...' : 'پیشنهاد دسته‌بندی هوشمند'}
              </button>
            </div>
            <input
              id="exp-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: آهن و میلگرد"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
            />
            {aiError && <p className="mt-1 text-xs text-amber-700">{aiError}</p>}
          </div>

          <div>
            <label
              htmlFor="exp-amount"
              className="block text-sm font-medium text-slate-700"
            >
              ۵. مبلغ پایه ({currency}) <span className="text-red-600">*</span>
            </label>
            <input
              id="exp-amount"
              type="text"
              inputMode="numeric"
              value={baseAmountRaw}
              onChange={(e) => setBaseAmountRaw(normalizeDigits(e.target.value))}
              placeholder="مثال: ۱۸۰۱۰۰۵۸۵۰۱"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
            />
            {parsedPreviewAmount !== null && (
              <p className="mt-1 text-xs font-medium text-slate-600 tabular-nums">
                مبلغ خوانا: {formatCurrencyValue(parsedPreviewAmount, currency)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {saving
                ? 'در حال ثبت...'
                : initialExpense
                  ? 'ذخیرهٔ تغییرات'
                  : 'ثبت هزینه'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
