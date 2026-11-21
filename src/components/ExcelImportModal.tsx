import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type * as XLSX from 'xlsx';
import type { ProjectCurrency } from '../types/app';
import {
  type ColumnMapping,
  type ParsedExcelRow,
  createSampleTemplateWorkbook,
  inspectSheet,
  readWorkbookFromArrayBuffer,
  validateMappedExcelRows,
} from '../utils/excelParser';
import { formatJalaliDisplay, normalizeDigits, parseJalaliDate } from '../utils/jalali';
import { formatCurrencyValue, formatNumberFa } from '../utils/pricing';

interface ExcelImportModalProps {
  open: boolean;
  existingCount: number;
  currency: ProjectCurrency;
  onClose: () => void;
  onImport: (
    items: Array<{
      categoryName: string;
      subcategory: string;
      dateJalali: string;
      title: string;
      baseAmount: number;
      source: 'اکسل';
    }>,
    mode: 'append' | 'replace'
  ) => Promise<boolean>;
}

export function ExcelImportModal({
  open,
  existingCount,
  currency,
  onClose,
  onImport,
}: ExcelImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [mapping, setMapping] = useState<ColumnMapping>({
    categoryName: null,
    subcategory: null,
    dateJalali: null,
    title: null,
    baseAmount: null,
  });
  const [editableRows, setEditableRows] = useState<ParsedExcelRow[] | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [confirmReplaceChecked, setConfirmReplaceChecked] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inspection = useMemo(() => {
    if (!workbook || !selectedSheet) return null;
    return inspectSheet(workbook, selectedSheet);
  }, [workbook, selectedSheet]);

  const validation = useMemo(() => {
    if (!inspection) return null;
    return validateMappedExcelRows(inspection, mapping);
  }, [inspection, mapping]);

  const activeRows = useMemo(() => {
    if (editableRows) return editableRows;
    return validation?.rows ?? [];
  }, [editableRows, validation]);

  const activeValidRows = useMemo(
    () => activeRows.filter((r) => r.valid && r.baseAmount !== null),
    [activeRows]
  );
  const activeInvalidRows = useMemo(
    () => activeRows.filter((r) => !r.valid && !r.ignoredAsSummary),
    [activeRows]
  );
  const activeSummaryRows = useMemo(
    () => activeRows.filter((r) => r.ignoredAsSummary),
    [activeRows]
  );
  const totalValidAmount = useMemo(
    () => activeValidRows.reduce((sum, r) => sum + (r.baseAmount ?? 0), 0),
    [activeValidRows]
  );

  if (!open) return null;

  const resetAll = () => {
    setStep(1);
    setFileName('');
    setWorkbook(null);
    setSelectedSheet('');
    setEditableRows(null);
    setImportMode('append');
    setConfirmReplaceChecked(false);
    setFileError(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const bytes = createSampleTemplateWorkbook();
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'نمونه-ساختار-استاندارد-هزینه.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = readWorkbookFromArrayBuffer(buffer);
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        setFileError('فایل انتخاب‌شده فاقد هرگونه برگهٔ اطلاعات است.');
        return;
      }
      const firstSheet = wb.SheetNames[0];
      const insp = inspectSheet(wb, firstSheet);
      setFileName(file.name);
      setWorkbook(wb);
      setSelectedSheet(firstSheet);
      setMapping(insp.suggestedMapping);
      setEditableRows(null);
      setStep(2);
    } catch {
      setFileError(
        'خواندن فایل با خطا مواجه شد. لطفاً از سالم بودن فایل اکسل مطمئن شوید.'
      );
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      const insp = inspectSheet(workbook, sheetName);
      setMapping(insp.suggestedMapping);
      setEditableRows(null);
    }
  };

  const handleGoToValidation = () => {
    if (!validation) return;
    setEditableRows(validation.rows.map((r) => ({ ...r })));
    setStep(3);
  };

  const handleRowFix = (
    rowNumber: number,
    field: 'categoryName' | 'subcategory' | 'dateJalali' | 'title' | 'rawBaseAmount',
    value: string
  ) => {
    setEditableRows((prev) => {
      if (!prev) return prev;
      return prev.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const next = { ...row, [field]: value };
        const errors: string[] = [];
        if (!next.categoryName.trim()) errors.push('دسته اصلی خالی است.');
        if (!next.title.trim()) errors.push('نام هزینه خالی است.');
        const dCheck = parseJalaliDate(next.dateJalali);
        if (!dCheck.valid) errors.push(dCheck.error ?? 'تاریخ معتبر نیست.');

        const cleanedAmt = normalizeDigits(next.rawBaseAmount.trim());
        let parsedAmt: number | null = null;
        if (!cleanedAmt) {
          errors.push('مبلغ پایه خالی است.');
        } else if (/[,٬]/.test(cleanedAmt)) {
          errors.push('مبلغ پایه نباید جداکنندهٔ هزارگان داشته باشد.');
        } else if (!/^\d+(\.\d+)?$/.test(cleanedAmt)) {
          errors.push('مبلغ پایه فقط باید عدد خالص بدون واحد پول باشد.');
        } else {
          parsedAmt = Number(cleanedAmt);
        }

        return {
          ...next,
          dateJalali: dCheck.normalized ?? next.dateJalali,
          baseAmount: parsedAmt,
          valid: errors.length === 0,
          errors,
        };
      });
    });
  };

  const handleRemoveRow = (rowNumber: number) => {
    setEditableRows((prev) =>
      prev ? prev.filter((r) => r.rowNumber !== rowNumber) : prev
    );
  };

  const handleIgnoreAllInvalid = () => {
    setEditableRows((prev) =>
      prev ? prev.filter((r) => r.valid && !r.ignoredAsSummary) : prev
    );
  };

  const handleConfirmImport = async () => {
    if (activeValidRows.length === 0) return;
    if (importMode === 'replace' && existingCount > 0 && !confirmReplaceChecked) {
      return;
    }

    setSubmitting(true);
    const ok = await onImport(
      activeValidRows.map((r) => ({
        categoryName: r.categoryName.trim(),
        subcategory: r.subcategory.trim(),
        dateJalali: r.dateJalali.trim(),
        title: r.title.trim(),
        baseAmount: r.baseAmount!,
        source: 'اکسل',
      })),
      importMode
    );
    setSubmitting(false);
    if (ok) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-import-title"
    >
      <div className="my-6 w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="excel-import-title" className="text-lg font-bold text-slate-900">
                ورود هزینه‌های پایه از فایل اکسل
              </h2>
              <p className="text-xs text-slate-500">
                ساختار استاندارد ۵ ستونی: دسته اصلی · زیردسته / بخش · تاریخ هزینه · نام هزینه · مبلغ پایه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="بستن پنجره ورود اکسل"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="mt-4 flex items-center gap-3 text-xs font-medium text-slate-600">
          <span className={step === 1 ? 'font-bold text-sky-800' : ''}>
            ۱. بارگذاری فایل
          </span>
          <span aria-hidden="true">/</span>
          <span className={step === 2 ? 'font-bold text-sky-800' : ''}>
            ۲. انتخاب شیت و تطبیق ستون‌ها
          </span>
          <span aria-hidden="true">/</span>
          <span className={step === 3 ? 'font-bold text-sky-800' : ''}>
            ۳. بررسی خطاها و تأیید نهایی
          </span>
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="mt-5 space-y-5">
            {fileError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {fileError}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Upload className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                فایل اکسل هزینه‌های پایه را انتخاب کنید
              </p>
              <p className="mt-1 text-xs text-slate-500">
                واحد پول از فایل خوانده نمی‌شود و بر اساس تنظیمات پروژه ({currency}) اعمال می‌گردد.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <label className="cursor-pointer rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0">
                  انتخاب فایل اکسل
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Download className="h-4 w-4" />
                  دریافت فایل نمونه استاندارد
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600">
              <p className="font-semibold text-slate-800">قوانین فایل ورودی اکسل:</p>
              <ul className="mt-1.5 list-disc space-y-1 pr-5">
                <li>ردیف اول باید عنوان ۵ ستون باشد: دسته اصلی، زیردسته / بخش، تاریخ هزینه، نام هزینه، مبلغ پایه.</li>
                <li>تاریخ فقط به صورت شمسی با قالب ۱۴۰۵/۰۷/۲۷ معتبر است.</li>
                <li>مبلغ پایه باید عدد خالص بدون ویرگول، فرمول یا نام واحد پول باشد.</li>
                <li>ردیف‌های جمع کل و سطرهای خالی به صورت خودکار نادیده گرفته می‌شوند.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Sheet selection & Column mapping */}
        {step === 2 && workbook && inspection && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">فایل:</span> {fileName}
                <span className="mx-2 text-slate-400">·</span>
                <span className="tabular-nums">
                  {formatNumberFa(inspection.rawRows.length)} ردیف شناسایی شد
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="sheet-select"
                  className="text-xs font-medium text-slate-700 whitespace-nowrap"
                >
                  انتخاب برگه (شیت):
                </label>
                <select
                  id="sheet-select"
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
                >
                  {workbook.SheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {inspection.extraColumnsWarning && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span>{inspection.extraColumnsWarning}</span>
              </div>
            )}

            {!inspection.exactOrderMatch && inspection.headers.length > 0 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3.5 text-xs text-sky-900">
                ترتیب یا نام ستون‌ها با ساختار ۵ ستونهٔ پیش‌فرض تفاوت دارد. لطفاً ستون‌های فایل را با فیلدهای سامانه تطبیق دهید تا به ساختار استاندارد تبدیل شوند.
              </div>
            )}

            {/* Column mapping selectors */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              {(
                [
                  ['categoryName', '۱. دسته اصلی'],
                  ['subcategory', '۲. زیردسته / بخش'],
                  ['dateJalali', '۳. تاریخ هزینه'],
                  ['title', '۴. نام هزینه'],
                  ['baseAmount', '۵. مبلغ پایه'],
                ] as const
              ).map(([fieldKey, label]) => (
                <div key={fieldKey}>
                  <label
                    htmlFor={`map-${fieldKey}`}
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {label}
                  </label>
                  <select
                    id={`map-${fieldKey}`}
                    value={mapping[fieldKey] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [fieldKey]:
                          e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                  >
                    <option value="">انتخاب نشده</option>
                    {inspection.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        ستون {formatNumberFa(idx + 1)}: {h || 'بدون عنوان'}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Raw Preview */}
            {inspection.rawRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">ردیف</th>
                      {inspection.headers.slice(0, 6).map((h, i) => (
                        <th key={i} className="px-3 py-2 font-semibold">
                          {h || `ستون ${formatNumberFa(i + 1)}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspection.rawRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="px-3 py-2 text-slate-500 tabular-nums">
                          {formatNumberFa(rIdx + 2)}
                        </td>
                        {inspection.headers.slice(0, 6).map((_, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-slate-800">
                            {row[cIdx] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {validation && validation.structuralErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                <p className="font-semibold">خطاهای ساختار ستون‌ها:</p>
                <ul className="mt-1 list-disc pr-4">
                  {validation.structuralErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                انتخاب فایل دیگر
              </button>
              <button
                type="button"
                disabled={!validation || validation.structuralErrors.length > 0}
                onClick={handleGoToValidation}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                بررسی ردیف‌ها و پیش‌نمایش نهایی
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Row validation & Confirmation */}
        {step === 3 && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">ردیف‌های آمادهٔ ورود</div>
                <div className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">
                  {formatNumberFa(activeValidRows.length)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">ردیف‌های نامعتبر</div>
                <div className="mt-1 text-lg font-bold text-red-700 tabular-nums">
                  {formatNumberFa(activeInvalidRows.length)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">جمع کل نادیده‌گرفته</div>
                <div className="mt-1 text-lg font-bold text-slate-700 tabular-nums">
                  {formatNumberFa(activeSummaryRows.length)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">جمع مبالغ معتبر</div>
                <div className="mt-1 text-base font-bold text-slate-900 tabular-nums">
                  {formatCurrencyValue(totalValidAmount, currency)}
                </div>
              </div>
            </div>

            {activeInvalidRows.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
                <span>
                  {formatNumberFa(activeInvalidRows.length)} ردیف دارای خطا هستند. می‌توانید مقادیر را همین‌جا اصلاح کنید، آن‌ها را حذف کنید یا با یک کلیک نادیده بگیرید.
                </span>
                <button
                  type="button"
                  onClick={handleIgnoreAllInvalid}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap shrink-0"
                >
                  نادیده‌گرفتن همهٔ ردیف‌های نامعتبر
                </button>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-2.5 py-2">ردیف</th>
                    <th className="px-2.5 py-2">دسته اصلی</th>
                    <th className="px-2.5 py-2">زیردسته</th>
                    <th className="px-2.5 py-2">تاریخ شمسی</th>
                    <th className="px-2.5 py-2">نام هزینه</th>
                    <th className="px-2.5 py-2">مبلغ پایه</th>
                    <th className="px-2.5 py-2">وضعیت / خطا</th>
                    <th className="px-2.5 py-2">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.ignoredAsSummary
                          ? 'bg-slate-50 text-slate-400'
                          : row.valid
                            ? 'bg-white'
                            : 'bg-red-50/60'
                      }
                    >
                      <td className="px-2.5 py-2 tabular-nums">
                        {formatNumberFa(row.rowNumber)}
                      </td>
                      <td className="px-2.5 py-2">
                        {row.valid || row.ignoredAsSummary ? (
                          row.categoryName || '—'
                        ) : (
                          <input
                            type="text"
                            value={row.categoryName}
                            onChange={(e) =>
                              handleRowFix(row.rowNumber, 'categoryName', e.target.value)
                            }
                            aria-label={`دسته ردیف ${row.rowNumber}`}
                            className="w-28 rounded border border-red-300 px-2 py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        {row.valid || row.ignoredAsSummary ? (
                          row.subcategory || '—'
                        ) : (
                          <input
                            type="text"
                            value={row.subcategory}
                            onChange={(e) =>
                              handleRowFix(row.rowNumber, 'subcategory', e.target.value)
                            }
                            aria-label={`زیردسته ردیف ${row.rowNumber}`}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums">
                        {row.valid || row.ignoredAsSummary ? (
                          formatJalaliDisplay(row.dateJalali)
                        ) : (
                          <input
                            type="text"
                            value={row.dateJalali}
                            onChange={(e) =>
                              handleRowFix(row.rowNumber, 'dateJalali', e.target.value)
                            }
                            aria-label={`تاریخ ردیف ${row.rowNumber}`}
                            className="w-24 rounded border border-red-300 px-2 py-1 text-xs tabular-nums"
                          />
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        {row.valid || row.ignoredAsSummary ? (
                          row.title || '—'
                        ) : (
                          <input
                            type="text"
                            value={row.title}
                            onChange={(e) =>
                              handleRowFix(row.rowNumber, 'title', e.target.value)
                            }
                            aria-label={`نام هزینه ردیف ${row.rowNumber}`}
                            className="w-36 rounded border border-red-300 px-2 py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="px-2.5 py-2 tabular-nums">
                        {row.valid && row.baseAmount !== null ? (
                          formatNumberFa(row.baseAmount)
                        ) : row.ignoredAsSummary ? (
                          '—'
                        ) : (
                          <input
                            type="text"
                            value={row.rawBaseAmount}
                            onChange={(e) =>
                              handleRowFix(row.rowNumber, 'rawBaseAmount', e.target.value)
                            }
                            aria-label={`مبلغ ردیف ${row.rowNumber}`}
                            className="w-28 rounded border border-red-300 px-2 py-1 text-xs tabular-nums"
                          />
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            معتبر
                          </span>
                        ) : (
                          <span className="text-red-700">
                            {row.errors.join(' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowNumber)}
                          aria-label={`حذف ردیف ${row.rowNumber}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Append vs Replace safety control */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-800">
                نحوهٔ ثبت در پروژه ({formatNumberFa(existingCount)} هزینهٔ قبلی ثبت شده است):
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="excel-import-mode"
                    checked={importMode === 'append'}
                    onChange={() => {
                      setImportMode('append');
                      setConfirmReplaceChecked(false);
                    }}
                  />
                  افزودن به هزینه‌های فعلی پروژه (پیش‌فرض و امن)
                </label>
                <label className="flex items-center gap-2 text-sm text-red-800 cursor-pointer">
                  <input
                    type="radio"
                    name="excel-import-mode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  جایگزینی کامل هزینه‌های پایهٔ فعلی
                </label>
              </div>

              {importMode === 'replace' && existingCount > 0 && (
                <label className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReplaceChecked}
                    onChange={(e) => setConfirmReplaceChecked(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    تأیید می‌کنم که با انتخاب جایگزینی، {formatNumberFa(existingCount)} ردیف هزینهٔ پایهٔ فعلی این پروژه حذف و با ردیف‌های معتبر این فایل جایگزین شود. (نسخه‌های قیمت‌گذاری قبلی بدون تغییر باقی می‌مانند.)
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                بازگشت به تطبیق ستون‌ها
              </button>
              <button
                type="button"
                disabled={
                  submitting ||
                  activeValidRows.length === 0 ||
                  activeInvalidRows.length > 0 ||
                  (importMode === 'replace' &&
                    existingCount > 0 &&
                    !confirmReplaceChecked)
                }
                onClick={handleConfirmImport}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting
                  ? 'در حال ثبت...'
                  : `تأیید و ورود ${formatNumberFa(activeValidRows.length)} ردیف معتبر`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
