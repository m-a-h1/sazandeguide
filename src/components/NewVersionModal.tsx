'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  formatJalaliDisplay,
  getTodayJalali,
  normalizeDigits,
  parseJalaliDate,
} from '../utils/jalali';
import {
  calculateProjectValuation,
  formatCurrencyValue,
  formatNumberFa,
  formatPercentFa,
} from '../utils/pricing';

interface NewVersionModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewVersionModal({ open, onClose }: NewVersionModalProps) {
  const {
    activeProject,
    projectExpenses,
    projectVersions,
    createPricingVersion,
  } = useWorkspace();

  const [name, setName] = useState('');
  const [versionDateJalali, setVersionDateJalali] = useState('');
  const [description, setDescription] = useState('');
  const [referenceMode, setReferenceMode] = useState<'BASE' | 'VERSION'>('BASE');
  const [referenceVersionId, setReferenceVersionId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(`برآورد شماره ${formatNumberFa(projectVersions.length + 1)}`);
    setVersionDateJalali(getTodayJalali());
    setDescription('');
    setReferenceMode('BASE');
    setReferenceVersionId(projectVersions[0]?.id ?? '');
    setError(null);
  }, [open, projectVersions]);

  const previewValuation = useMemo(() => {
    if (!activeProject) return null;
    const refVersion =
      referenceMode === 'VERSION' && referenceVersionId !== ''
        ? projectVersions.find((v) => v.id === Number(referenceVersionId)) ??
          null
        : null;

    return calculateProjectValuation({
      expenses: projectExpenses,
      categoryRates: activeProject.draftCategoryRates ?? {},
      areaSqm: activeProject.areaSqm,
      usefulAreaSqm: activeProject.usefulAreaSqm,
      taxPercent: activeProject.taxPercent ?? 0,
      landPrice: activeProject.landPrice ?? 0,
      partnershipPercent: activeProject.partnershipPercent ?? null,
      referenceVersion: refVersion,
    });
  }, [
    activeProject,
    projectExpenses,
    projectVersions,
    referenceMode,
    referenceVersionId,
  ]);

  if (!open || !activeProject) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('نام نسخهٔ قیمت‌گذاری الزامی است.');
      return;
    }

    const dateCheck = parseJalaliDate(versionDateJalali);
    if (!dateCheck.valid) {
      setError(`تاریخ شمسی نسخه نامعتبر است: ${dateCheck.error}`);
      return;
    }

    if (referenceMode === 'VERSION' && !referenceVersionId) {
      setError('لطفاً نسخهٔ مرجع را انتخاب کنید.');
      return;
    }

    setSaving(true);
    const created = await createPricingVersion({
      name: name.trim(),
      versionDateJalali: dateCheck.normalized!,
      description: description.trim(),
      referenceVersionId:
        referenceMode === 'VERSION' ? Number(referenceVersionId) : null,
    });
    setSaving(false);

    if (created) {
      onClose();
    } else {
      setError('ثبت نسخه با خطا مواجه شد.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-version-title"
    >
      <div className="my-8 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 id="new-version-title" className="text-lg font-bold text-slate-900">
            ثبت نسخهٔ جدید قیمت‌گذاری
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن فرم ثبت نسخه"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <p className="text-xs leading-6 text-slate-600">
            با ثبت نسخه، تصویر کاملی از درصد دسته‌ها، درصدهای مستقل و مبالغ برآوردی فعلی به صورت ثابت ذخیره می‌شود. قیمت پایه و نسخه‌های قبلی هرگز تغییر نخواهند کرد.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ver-name"
                className="block text-sm font-medium text-slate-700"
              >
                نام نسخه <span className="text-red-600">*</span>
              </label>
              <input
                id="ver-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: برآورد مهر ۱۴۰۵"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="ver-date"
                className="block text-sm font-medium text-slate-700"
              >
                تاریخ نسخه (شمسی) <span className="text-red-600">*</span>
              </label>
              <input
                id="ver-date"
                type="text"
                value={versionDateJalali}
                onChange={(e) =>
                  setVersionDateJalali(normalizeDigits(e.target.value))
                }
                placeholder="۱۴۰۵/۰۷/۲۷"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 tabular-nums focus:border-sky-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-800">
              مبنای محاسبهٔ این نسخه:
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="ver-ref-mode"
                checked={referenceMode === 'BASE'}
                onChange={() => setReferenceMode('BASE')}
              />
              محاسبه از روی قیمت پایهٔ ثابت پروژه (پیش‌فرض)
            </label>

            {projectVersions.length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="ver-ref-mode"
                    checked={referenceMode === 'VERSION'}
                    onChange={() => setReferenceMode('VERSION')}
                  />
                  محاسبه بر اساس یکی از نسخه‌های قبلی
                </label>

                {referenceMode === 'VERSION' && (
                  <select
                    aria-label="انتخاب نسخه مرجع"
                    value={referenceVersionId}
                    onChange={(e) =>
                      setReferenceVersionId(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {projectVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({formatJalaliDisplay(v.versionDateJalali)}) —{' '}
                        {formatCurrencyValue(
                          v.totalEstimatedAmount,
                          activeProject.currency
                        )}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="ver-desc"
              className="block text-sm font-medium text-slate-700"
            >
              توضیحات نسخه
            </label>
            <textarea
              id="ver-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شرح دلایل تعدیل نرخ‌ها یا مفروضات بازار در این تاریخ"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none"
            />
          </div>

          {previewValuation && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs space-y-1.5 tabular-nums">
              <div className="flex justify-between text-slate-600">
                <span>جمع قیمت پایه (ثابت):</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrencyValue(
                    previewValuation.totalBaseAmount,
                    activeProject.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-800">
                <span>جمع برآورد این نسخه:</span>
                <span className="font-bold text-sky-900">
                  {formatCurrencyValue(
                    previewValuation.totalEstimatedAmount,
                    activeProject.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  مالیات ({formatPercentFa(previewValuation.taxPercent)}):
                </span>
                <span className="font-semibold text-slate-900">
                  {formatCurrencyValue(
                    previewValuation.estimatedTaxAmount,
                    activeProject.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-900">
                <span>جمع کل با مالیات:</span>
                <span className="font-bold text-slate-950">
                  {formatCurrencyValue(
                    previewValuation.totalEstimatedWithTax,
                    activeProject.currency
                  )}
                </span>
              </div>
              {previewValuation.partnership.landPrice > 0 && (
                <>
                  <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-1.5">
                    <span>قیمت زمین:</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrencyValue(
                        previewValuation.partnership.landPrice,
                        activeProject.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-900">
                    <span>جمع کل با احتساب زمین:</span>
                    <span className="font-bold text-slate-950">
                      {formatCurrencyValue(
                        previewValuation.partnership.totalEstimatedWithLand,
                        activeProject.currency
                      )}
                    </span>
                  </div>
                </>
              )}
              {previewValuation.partnership.partnershipCostPerBuilderUsefulSqm !==
                null && (
                <div className="flex justify-between text-sky-900">
                  <span>
                    سود مشارکت (سهم{' '}
                    {formatPercentFa(
                      previewValuation.partnership.partnershipPercent ?? 0
                    )}
                    ):
                  </span>
                  <span className="font-bold">
                    {formatCurrencyValue(
                      previewValuation.partnership
                        .partnershipCostPerBuilderUsefulSqm,
                      activeProject.currency
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>اختلاف کل نسبت به قیمت پایه:</span>
                <span className="font-semibold">
                  {formatNumberFa(previewValuation.diffFromBaseAmount, {
                    showPlus: true,
                  })}{' '}
                  (
                  {formatPercentFa(previewValuation.diffFromBasePercent, {
                    showPlus: true,
                  })}
                  )
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'در حال ثبت...' : 'ذخیرهٔ نسخهٔ قیمت‌گذاری'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
