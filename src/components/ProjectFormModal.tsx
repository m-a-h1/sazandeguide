'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Project, ProjectCurrency, ProjectStatus } from '../types/app';
import { getTodayJalali, normalizeDigits, parseJalaliDate } from '../utils/jalali';
import { parseStrictNumericInput } from '../utils/pricing';

interface ProjectFormModalProps {
  open: boolean;
  initialProject?: Project | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    address: string;
    description: string;
    areaSqm: number | null;
    usefulAreaSqm: number | null;
    floors: number | null;
    units: number | null;
    startDateJalali: string;
    endDateJalali: string;
    status: ProjectStatus;
    currency: ProjectCurrency;
    taxPercent: number;
    landPrice: number;
    partnershipPercent: number | null;
  }) => Promise<boolean>;
}

export function ProjectFormModal({
  open,
  initialProject,
  onClose,
  onSave,
}: ProjectFormModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [usefulAreaSqm, setUsefulAreaSqm] = useState('');
  const [floors, setFloors] = useState('');
  const [units, setUnits] = useState('');
  const [startDateJalali, setStartDateJalali] = useState('');
  const [endDateJalali, setEndDateJalali] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('در حال ساخت');
  const [currency, setCurrency] = useState<ProjectCurrency>('تومان');
  const [taxPercent, setTaxPercent] = useState('0');
  const [landPrice, setLandPrice] = useState('0');
  const [partnershipPercent, setPartnershipPercent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialProject) {
      setName(initialProject.name);
      setAddress(initialProject.address);
      setDescription(initialProject.description);
      setAreaSqm(initialProject.areaSqm ? String(initialProject.areaSqm) : '');
      setUsefulAreaSqm(
        initialProject.usefulAreaSqm ? String(initialProject.usefulAreaSqm) : ''
      );
      setFloors(initialProject.floors !== null ? String(initialProject.floors) : '');
      setUnits(initialProject.units !== null ? String(initialProject.units) : '');
      setStartDateJalali(initialProject.startDateJalali);
      setEndDateJalali(initialProject.endDateJalali);
      setStatus(initialProject.status);
      setCurrency(initialProject.currency);
      setTaxPercent(String(initialProject.taxPercent ?? 0));
      setLandPrice(
        initialProject.landPrice && initialProject.landPrice > 0
          ? String(initialProject.landPrice)
          : '0'
      );
      setPartnershipPercent(
        initialProject.partnershipPercent !== null &&
          initialProject.partnershipPercent !== undefined
          ? String(initialProject.partnershipPercent)
          : ''
      );
    } else {
      setName('');
      setAddress('');
      setDescription('');
      setAreaSqm('');
      setUsefulAreaSqm('');
      setFloors('');
      setUnits('');
      setStartDateJalali(getTodayJalali());
      setEndDateJalali('');
      setStatus('در حال ساخت');
      setCurrency('تومان');
      setTaxPercent('0');
      setLandPrice('0');
      setPartnershipPercent('');
    }
    setError(null);
  }, [open, initialProject]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('لطفاً نام پروژه را وارد کنید.');
      return;
    }

    let parsedArea: number | null = null;
    if (areaSqm.trim()) {
      const val = parseStrictNumericInput(areaSqm);
      if (val === null || val <= 0) {
        setError('متراژ زیربنای کل باید عددی مثبت باشد.');
        return;
      }
      parsedArea = val;
    }

    let parsedUsefulArea: number | null = null;
    if (usefulAreaSqm.trim()) {
      const val = parseStrictNumericInput(usefulAreaSqm);
      if (val === null || val <= 0) {
        setError('متراژ زیربنای مفید باید عددی مثبت باشد.');
        return;
      }
      parsedUsefulArea = val;
    }

    let parsedFloors: number | null = null;
    if (floors.trim()) {
      const val = parseStrictNumericInput(floors);
      if (val === null || val < 0 || !Number.isInteger(val)) {
        setError('تعداد طبقات باید عدد صحیح غیرمنفی باشد.');
        return;
      }
      parsedFloors = val;
    }

    let parsedUnits: number | null = null;
    if (units.trim()) {
      const val = parseStrictNumericInput(units);
      if (val === null || val < 0 || !Number.isInteger(val)) {
        setError('تعداد واحدها باید عدد صحیح غیرمنفی باشد.');
        return;
      }
      parsedUnits = val;
    }

    let normalizedStart = '';
    if (startDateJalali.trim()) {
      const check = parseJalaliDate(startDateJalali);
      if (!check.valid) {
        setError(`تاریخ شروع نامعتبر است: ${check.error}`);
        return;
      }
      normalizedStart = check.normalized!;
    }

    let normalizedEnd = '';
    if (endDateJalali.trim()) {
      const check = parseJalaliDate(endDateJalali);
      if (!check.valid) {
        setError(`تاریخ پایان نامعتبر است: ${check.error}`);
        return;
      }
      normalizedEnd = check.normalized!;
    }

    let parsedTax = 0;
    if (taxPercent.trim()) {
      const val = parseStrictNumericInput(taxPercent);
      if (val === null || val < 0 || val > 100) {
        setError('درصد مالیات باید عددی بین ۰ تا ۱۰۰ باشد.');
        return;
      }
      parsedTax = val;
    }

    let parsedLandPrice = 0;
    if (landPrice.trim()) {
      const val = parseStrictNumericInput(landPrice);
      if (val === null || val < 0) {
        setError('قیمت زمین نمی‌تواند منفی یا نامعتبر باشد.');
        return;
      }
      parsedLandPrice = val;
    }

    let parsedPartnershipPercent: number | null = null;
    if (partnershipPercent.trim()) {
      const val = parseStrictNumericInput(partnershipPercent);
      if (val === null || val <= 0 || val > 100) {
        setError('درصد مشارکت باید عددی بزرگ‌تر از ۰ و حداکثر ۱۰۰ باشد.');
        return;
      }
      parsedPartnershipPercent = val;
    }

    setSaving(true);
    const ok = await onSave({
      name: name.trim(),
      address: address.trim(),
      description: description.trim(),
      areaSqm: parsedArea,
      usefulAreaSqm: parsedUsefulArea,
      floors: parsedFloors,
      units: parsedUnits,
      startDateJalali: normalizedStart,
      endDateJalali: normalizedEnd,
      status,
      currency,
      taxPercent: parsedTax,
      landPrice: parsedLandPrice,
      partnershipPercent: parsedPartnershipPercent,
    });
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('ذخیرهٔ اطلاعات پروژه با خطا مواجه شد.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-form-title"
    >
      <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 id="project-form-title" className="text-lg font-bold text-slate-900">
            {initialProject ? 'ویرایش مشخصات پروژه' : 'تعریف پروژهٔ ساختمانی جدید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن فرم پروژه"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="proj-name"
                className="block text-sm font-medium text-slate-700"
              >
                نام پروژه <span className="text-red-600">*</span>
              </label>
              <input
                id="proj-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: برج مسکونی صیاد ۵"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="proj-address"
                className="block text-sm font-medium text-slate-700"
              >
                آدرس پروژه
              </label>
              <input
                id="proj-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="شهر، منطقه، خیابان یا پلاک"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div className="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="proj-status"
                  className="block text-sm font-medium text-slate-700"
                >
                  وضعیت پروژه
                </label>
                <select
                  id="proj-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                >
                  <option value="در حال ساخت">در حال ساخت</option>
                  <option value="تکمیل‌شده">تکمیل‌شده</option>
                  <option value="متوقف‌شده">متوقف‌شده</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="proj-currency"
                  className="block text-sm font-medium text-slate-700"
                >
                  واحد پول پروژه
                </label>
                <select
                  id="proj-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as ProjectCurrency)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                >
                  <option value="تومان">تومان</option>
                  <option value="ریال">ریال</option>
                  <option value="تعیین‌نشده">تعیین‌نشده</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="proj-tax"
                  className="block text-sm font-medium text-slate-700"
                >
                  درصد مالیات پروژه (٪)
                </label>
                <input
                  id="proj-tax"
                  type="text"
                  inputMode="decimal"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(normalizeDigits(e.target.value))}
                  placeholder="مثال: ۹"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="proj-area"
                className="block text-sm font-medium text-slate-700"
              >
                زیربنای کل (مترمربع)
              </label>
              <input
                id="proj-area"
                type="text"
                inputMode="decimal"
                value={areaSqm}
                onChange={(e) => setAreaSqm(normalizeDigits(e.target.value))}
                placeholder="مثال: ۲۵۰۰"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="proj-useful-area"
                className="block text-sm font-medium text-slate-700"
              >
                زیربنای مفید (مترمربع)
              </label>
              <input
                id="proj-useful-area"
                type="text"
                inputMode="decimal"
                value={usefulAreaSqm}
                onChange={(e) =>
                  setUsefulAreaSqm(normalizeDigits(e.target.value))
                }
                placeholder="مثال: ۲۰۰۰"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="proj-land-price"
                className="block text-sm font-medium text-slate-700"
              >
                قیمت زمین (
                {currency === 'تعیین‌نشده' ? 'مبلغ عددی' : currency})
              </label>
              <input
                id="proj-land-price"
                type="text"
                inputMode="decimal"
                value={landPrice}
                onChange={(e) => setLandPrice(normalizeDigits(e.target.value))}
                placeholder="مثال: ۱۰۰۰۰۰۰۰۰۰۰۰"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="proj-partnership-percent"
                className="block text-sm font-medium text-slate-700"
              >
                درصد مشارکت / سهم سازنده از زیربنای مفید (٪)
              </label>
              <input
                id="proj-partnership-percent"
                type="text"
                inputMode="decimal"
                value={partnershipPercent}
                onChange={(e) =>
                  setPartnershipPercent(normalizeDigits(e.target.value))
                }
                placeholder="مثال: ۵۰"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="proj-floors"
                className="block text-sm font-medium text-slate-700"
              >
                تعداد طبقات
              </label>
              <input
                id="proj-floors"
                type="text"
                inputMode="numeric"
                value={floors}
                onChange={(e) => setFloors(normalizeDigits(e.target.value))}
                placeholder="مثال: ۶"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="proj-units"
                className="block text-sm font-medium text-slate-700"
              >
                تعداد واحدها
              </label>
              <input
                id="proj-units"
                type="text"
                inputMode="numeric"
                value={units}
                onChange={(e) => setUnits(normalizeDigits(e.target.value))}
                placeholder="مثال: ۱۲"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="proj-start"
                className="block text-sm font-medium text-slate-700"
              >
                تاریخ شروع (شمسی)
              </label>
              <input
                id="proj-start"
                type="text"
                value={startDateJalali}
                onChange={(e) => setStartDateJalali(normalizeDigits(e.target.value))}
                placeholder="۱۴۰۵/۰۷/۲۷"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="proj-end"
                className="block text-sm font-medium text-slate-700"
              >
                تاریخ پایان پیش‌بینی یا واقعی (شمسی)
              </label>
              <input
                id="proj-end"
                type="text"
                value={endDateJalali}
                onChange={(e) => setEndDateJalali(normalizeDigits(e.target.value))}
                placeholder="۱۴۰۶/۱۲/۲۰"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="proj-desc"
                className="block text-sm font-medium text-slate-700"
              >
                توضیحات پروژه
              </label>
              <textarea
                id="proj-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات تکمیلی، نوع اسکلت، کاربری یا نکات اجرایی"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20"
              />
            </div>
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
              {saving ? 'در حال ذخیره...' : 'ذخیرهٔ پروژه'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
