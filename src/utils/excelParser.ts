import * as XLSX from 'xlsx';
import type { ExpenseItem, PricingVersion, ProjectCurrency, VersionItemSnapshot } from '../types/app';
import { normalizeDigits, parseJalaliDate } from './jalali';

export const EXCEL_STANDARD_HEADERS = [
  'دسته اصلی',
  'زیردسته / بخش',
  'تاریخ هزینه',
  'نام هزینه',
  'مبلغ پایه',
] as const;

export type StandardFieldKey =
  | 'categoryName'
  | 'subcategory'
  | 'dateJalali'
  | 'title'
  | 'baseAmount';

export interface ColumnMapping {
  categoryName: number | null;
  subcategory: number | null;
  dateJalali: number | null;
  title: number | null;
  baseAmount: number | null;
}

export interface ParsedExcelRow {
  rowNumber: number;
  categoryName: string;
  subcategory: string;
  dateJalali: string;
  title: string;
  baseAmount: number | null;
  rawBaseAmount: string;
  valid: boolean;
  ignoredAsSummary: boolean;
  errors: string[];
}

export interface SheetInspectionResult {
  sheetName: string;
  headers: string[];
  rawRows: string[][];
  exactHeaderMatch: boolean;
  exactOrderMatch: boolean;
  hasExtraColumns: boolean;
  extraColumnsWarning: string | null;
  suggestedMapping: ColumnMapping;
}

export interface ExcelValidationSummary {
  rows: ParsedExcelRow[];
  validRows: ParsedExcelRow[];
  invalidRows: ParsedExcelRow[];
  ignoredSummaryRows: ParsedExcelRow[];
  totalValidAmount: number;
  structuralErrors: string[];
}

const SUMMARY_KEYWORDS = [
  'جمع کل',
  'جمع گروه',
  'جمع دسته',
  'جمع مبالغ',
  'جمع بخش',
  'مجموع کل',
];

function cleanHeader(h: unknown): string {
  return normalizeDigits(String(h ?? ''))
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    categoryName: null,
    subcategory: null,
    dateJalali: null,
    title: null,
    baseAmount: null,
  };

  headers.forEach((raw, idx) => {
    const h = cleanHeader(raw);
    if (!h) return;
    if (h === 'دسته اصلی' || (h.includes('دسته') && !h.includes('زیر'))) {
      if (mapping.categoryName === null) mapping.categoryName = idx;
    } else if (
      h === 'زیردسته / بخش' ||
      h.includes('زیردسته') ||
      h.includes('زیرمجموعه') ||
      h.includes('بخش')
    ) {
      if (mapping.subcategory === null) mapping.subcategory = idx;
    } else if (h === 'تاریخ هزینه' || h.includes('تاریخ')) {
      if (mapping.dateJalali === null) mapping.dateJalali = idx;
    } else if (h === 'نام هزینه' || h.includes('نام') || h.includes('شرح')) {
      if (mapping.title === null) mapping.title = idx;
    } else if (h === 'مبلغ پایه' || h.includes('مبلغ')) {
      if (mapping.baseAmount === null) mapping.baseAmount = idx;
    }
  });

  return mapping;
}

export function readWorkbookFromArrayBuffer(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: 'array', raw: false });
}

export function inspectSheet(
  workbook: XLSX.WorkBook,
  sheetName: string
): SheetInspectionResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      sheetName,
      headers: [],
      rawRows: [],
      exactHeaderMatch: false,
      exactOrderMatch: false,
      hasExtraColumns: false,
      extraColumnsWarning: 'برگه انتخاب‌شده در فایل اکسل یافت نشد.',
      suggestedMapping: {
        categoryName: null,
        subcategory: null,
        dateJalali: null,
        title: null,
        baseAmount: null,
      },
    };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const nonEmptyMatrix = matrix.filter((row) =>
    Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
  );

  if (nonEmptyMatrix.length === 0) {
    return {
      sheetName,
      headers: [],
      rawRows: [],
      exactHeaderMatch: false,
      exactOrderMatch: false,
      hasExtraColumns: false,
      extraColumnsWarning: 'این برگه خالی است و ردیفی برای بررسی ندارد.',
      suggestedMapping: {
        categoryName: null,
        subcategory: null,
        dateJalali: null,
        title: null,
        baseAmount: null,
      },
    };
  }

  const headerRow = nonEmptyMatrix[0].map((c) => String(c ?? '').trim());
  const rawRows = nonEmptyMatrix.slice(1).map((row) =>
    row.map((c) => String(c ?? '').trim())
  );

  const exactOrderMatch =
    headerRow.length === 5 &&
    EXCEL_STANDARD_HEADERS.every(
      (expected, idx) => cleanHeader(headerRow[idx]) === cleanHeader(expected)
    );

  const suggestedMapping = detectColumnMapping(headerRow);
  const exactHeaderMatch =
    suggestedMapping.categoryName !== null &&
    suggestedMapping.subcategory !== null &&
    suggestedMapping.dateJalali !== null &&
    suggestedMapping.title !== null &&
    suggestedMapping.baseAmount !== null;

  const hasExtraColumns = headerRow.length > 5;
  const extraColumnsWarning = hasExtraColumns
    ? `هشدار: این برگه دارای ${headerRow.length} ستون است. مطابق ساختار استاندارد، فایل اکسل باید دقیقاً ۵ ستون داشته باشد؛ ستون‌های اضافی پردازش نخواهند شد.`
    : null;

  return {
    sheetName,
    headers: headerRow,
    rawRows,
    exactHeaderMatch,
    exactOrderMatch,
    hasExtraColumns,
    extraColumnsWarning,
    suggestedMapping,
  };
}

export function isSummaryOrHeadingRow(cells: string[]): boolean {
  const joined = normalizeDigits(cells.join(' ').trim());
  if (!joined) return true;
  return SUMMARY_KEYWORDS.some((kw) => joined.includes(kw));
}

export function validateStrictExcelAmount(raw: string): {
  valid: boolean;
  amount: number | null;
  error?: string;
} {
  const trimmed = normalizeDigits(String(raw ?? '').trim());
  if (!trimmed) {
    return { valid: false, amount: null, error: 'مبلغ پایه خالی است.' };
  }
  if (/تومان|ریال|دلار|درهم|یورو/i.test(trimmed)) {
    return {
      valid: false,
      amount: null,
      error: 'مبلغ پایه نباید شامل واحد پول یا متن باشد.',
    };
  }
  if (/[,٬]/.test(trimmed)) {
    return {
      valid: false,
      amount: null,
      error: 'مبلغ پایه نباید دارای جداکنندهٔ هزارگان (ویرگول) باشد و باید فقط عدد خالص باشد.',
    };
  }
  if (/^=/.test(trimmed)) {
    return {
      valid: false,
      amount: null,
      error: 'مبلغ پایه نباید به صورت فرمول اکسل باشد.',
    };
  }
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return {
      valid: false,
      amount: null,
      error: 'مبلغ پایه عددی معتبر نیست و نباید شامل حروف یا علامت باشد.',
    };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) {
    return {
      valid: false,
      amount: null,
      error: 'مبلغ پایه نمی‌تواند منفی یا نامعتبر باشد.',
    };
  }
  return { valid: true, amount: num };
}

export function validateMappedExcelRows(
  inspection: SheetInspectionResult,
  mapping: ColumnMapping
): ExcelValidationSummary {
  const structuralErrors: string[] = [];

  if (inspection.headers.length === 0) {
    structuralErrors.push('ردیف عنوان ستون‌ها در فایل یافت نشد.');
  }
  if (inspection.headers.length < 5) {
    structuralErrors.push(
      'تعداد ستون‌های فایل کمتر از ۵ ستون استاندارد است.'
    );
  }
  if (mapping.categoryName === null) {
    structuralErrors.push('ستون «دسته اصلی» تطبیق داده نشده است.');
  }
  if (mapping.subcategory === null) {
    structuralErrors.push('ستون «زیردسته / بخش» تطبیق داده نشده است.');
  }
  if (mapping.dateJalali === null) {
    structuralErrors.push('ستون «تاریخ هزینه» تطبیق داده نشده است.');
  }
  if (mapping.title === null) {
    structuralErrors.push('ستون «نام هزینه» تطبیق داده نشده است.');
  }
  if (mapping.baseAmount === null) {
    structuralErrors.push('ستون «مبلغ پایه» تطبیق داده نشده است.');
  }

  const rows: ParsedExcelRow[] = [];
  const validRows: ParsedExcelRow[] = [];
  const invalidRows: ParsedExcelRow[] = [];
  const ignoredSummaryRows: ParsedExcelRow[] = [];
  let totalValidAmount = 0;

  if (structuralErrors.length > 0) {
    return {
      rows,
      validRows,
      invalidRows,
      ignoredSummaryRows,
      totalValidAmount,
      structuralErrors,
    };
  }

  inspection.rawRows.forEach((rawCells, index) => {
    const rowNumber = index + 2; // Row 1 is header
    const nonEmpty = rawCells.some((c) => String(c ?? '').trim() !== '');
    if (!nonEmpty) return;

    const categoryName = (rawCells[mapping.categoryName!] ?? '').trim();
    const subcategory = (rawCells[mapping.subcategory!] ?? '').trim();
    const dateRaw = (rawCells[mapping.dateJalali!] ?? '').trim();
    const title = (rawCells[mapping.title!] ?? '').trim();
    const rawBaseAmount = (rawCells[mapping.baseAmount!] ?? '').trim();

    if (isSummaryOrHeadingRow([categoryName, subcategory, title])) {
      const summaryRow: ParsedExcelRow = {
        rowNumber,
        categoryName,
        subcategory,
        dateJalali: dateRaw,
        title,
        baseAmount: null,
        rawBaseAmount,
        valid: false,
        ignoredAsSummary: true,
        errors: ['ردیف جمع کل یا عنوان فرعی است و به عنوان هزینه وارد نمی‌شود.'],
      };
      rows.push(summaryRow);
      ignoredSummaryRows.push(summaryRow);
      return;
    }

    const errors: string[] = [];

    if (!categoryName) {
      errors.push('دسته اصلی خالی است.');
    }
    if (!title) {
      errors.push('نام هزینه خالی است.');
    }

    const dateCheck = parseJalaliDate(dateRaw);
    if (!dateCheck.valid) {
      errors.push(dateCheck.error ?? 'تاریخ هزینه معتبر نیست.');
    }

    const amountCheck = validateStrictExcelAmount(rawBaseAmount);
    if (!amountCheck.valid) {
      errors.push(amountCheck.error ?? 'مبلغ پایه معتبر نیست.');
    }

    const parsed: ParsedExcelRow = {
      rowNumber,
      categoryName,
      subcategory,
      dateJalali: dateCheck.normalized ?? dateRaw,
      title,
      baseAmount: amountCheck.amount,
      rawBaseAmount,
      valid: errors.length === 0,
      ignoredAsSummary: false,
      errors,
    };

    rows.push(parsed);
    if (parsed.valid && parsed.baseAmount !== null) {
      validRows.push(parsed);
      totalValidAmount += parsed.baseAmount;
    } else {
      invalidRows.push(parsed);
    }
  });

  return {
    rows,
    validRows,
    invalidRows,
    ignoredSummaryRows,
    totalValidAmount,
    structuralErrors,
  };
}

export function createSampleTemplateWorkbook(): Uint8Array {
  const rows = [
    [...EXCEL_STANDARD_HEADERS],
    ['مواد و مصالح', 'سازه و اسکلت', '1405/07/27', 'آهن و میلگرد', 18010058501],
    ['مواد و مصالح', 'سازه و اسکلت', '1405/07/27', 'بتن آماده', 8210670130],
    ['پیمان و اجرا', 'سازه و اسکلت', '1405/07/27', 'هزینه آرماتوربندی', 5267800000],
    ['حقوق و دستمزد', 'پرسنل کارگاه', '1405/07/27', 'هزینه حقوق و دستمزد', 7200300001],
    ['اداری و تشکیلاتی', 'دفتر و بالاسری', '1405/07/27', 'هزینه اجاره دفتر', 137074443],
    ['مالی و تسهیلات', 'بانکی', '1405/07/27', 'بهره پرداختی', 23713710000],
    ['فروش و بازاریابی', 'تبلیغات', '1405/07/27', 'هزینه تبلیغات و آگهی', 250000000],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 36 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'هزینه‌های پایه');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

export function createProjectExportWorkbook(params: {
  projectName: string;
  currency: ProjectCurrency;
  versionName: string;
  versionDateJalali: string;
  taxPercent?: number;
  areaSqm?: number | null;
  usefulAreaSqm?: number | null;
  landPrice?: number;
  partnershipPercent?: number | null;
  items: VersionItemSnapshot[];
  versions?: PricingVersion[];
  expenses?: ExpenseItem[];
}): Uint8Array {
  const {
    projectName,
    currency,
    versionName,
    versionDateJalali,
    taxPercent = 0,
    areaSqm = null,
    usefulAreaSqm = null,
    landPrice = 0,
    partnershipPercent = null,
    items,
    versions,
  } = params;
  const safeTaxPercent =
    typeof taxPercent === 'number' && Number.isFinite(taxPercent) && taxPercent >= 0
      ? taxPercent
      : 0;
  const safeLandPrice =
    typeof landPrice === 'number' && Number.isFinite(landPrice) && landPrice >= 0
      ? landPrice
      : 0;
  const safePartnership =
    typeof partnershipPercent === 'number' &&
    Number.isFinite(partnershipPercent) &&
    partnershipPercent > 0 &&
    partnershipPercent <= 100
      ? partnershipPercent
      : null;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Full Valuation Report (Persian headers)
  const reportRows: (string | number)[][] = [
    [
      'پروژه',
      projectName,
      'نسخه قیمت‌گذاری',
      versionName,
      'تاریخ نسخه',
      versionDateJalali,
      'واحد پول',
      currency,
      'درصد مالیات',
      `${safeTaxPercent}٪`,
    ],
    [],
    [
      'ردیف',
      'نام هزینه',
      'دسته اصلی',
      'زیردسته / بخش',
      'تاریخ هزینه',
      'مبلغ پایه',
      'درصد مؤثر',
      'نوع نرخ',
      'مبلغ برآوردی',
      'اختلاف مبلغی',
    ],
  ];

  let totalBase = 0;
  let totalEst = 0;

  items.forEach((item, idx) => {
    totalBase += item.baseAmount;
    totalEst += item.estimatedAmount;
    reportRows.push([
      idx + 1,
      item.title,
      item.categoryName,
      item.subcategory || '—',
      item.dateJalali,
      item.baseAmount,
      item.effectivePercent,
      item.rateSource === 'INDEPENDENT' ? 'درصد مستقل' : 'پیروی از دسته',
      Math.round(item.estimatedAmount),
      Math.round(item.diffFromBaseAmount),
    ]);
  });

  reportRows.push([
    '',
    'جمع کل',
    '',
    '',
    '',
    totalBase,
    totalBase > 0 ? Number((((totalEst - totalBase) / totalBase) * 100).toFixed(2)) : 0,
    '',
    Math.round(totalEst),
    Math.round(totalEst - totalBase),
  ]);

  if (safeTaxPercent > 0) {
    const baseTax = totalBase * (safeTaxPercent / 100);
    const estTax = totalEst * (safeTaxPercent / 100);
    reportRows.push([
      '',
      `مالیات (${safeTaxPercent}٪)`,
      '',
      '',
      '',
      Math.round(baseTax),
      safeTaxPercent,
      '',
      Math.round(estTax),
      Math.round(estTax - baseTax),
    ]);
    reportRows.push([
      '',
      'جمع کل با مالیات',
      '',
      '',
      '',
      Math.round(totalBase + baseTax),
      '',
      '',
      Math.round(totalEst + estTax),
      Math.round((totalEst + estTax) - (totalBase + baseTax)),
    ]);
  }

  if (typeof areaSqm === 'number' && areaSqm > 0) {
    reportRows.push([
      '',
      `قیمت هر مترمربع زیربنای کل (${areaSqm} مترمربع)`,
      '',
      '',
      '',
      Math.round(totalBase / areaSqm),
      '',
      '',
      Math.round(totalEst / areaSqm),
      Math.round((totalEst - totalBase) / areaSqm),
    ]);
  }

  if (typeof usefulAreaSqm === 'number' && usefulAreaSqm > 0) {
    reportRows.push([
      '',
      `قیمت هر مترمربع زیربنای مفید (${usefulAreaSqm} مترمربع)`,
      '',
      '',
      '',
      Math.round(totalBase / usefulAreaSqm),
      '',
      '',
      Math.round(totalEst / usefulAreaSqm),
      Math.round((totalEst - totalBase) / usefulAreaSqm),
    ]);
  }

  if (safeLandPrice > 0) {
    reportRows.push([
      '',
      'قیمت زمین',
      '',
      '',
      '',
      Math.round(safeLandPrice),
      '',
      '',
      Math.round(safeLandPrice),
      0,
    ]);
    reportRows.push([
      '',
      'جمع کل با احتساب قیمت زمین',
      '',
      '',
      '',
      Math.round(totalBase + safeLandPrice),
      '',
      '',
      Math.round(totalEst + safeLandPrice),
      Math.round(totalEst - totalBase),
    ]);
    if (safeTaxPercent > 0) {
      const estTax = totalEst * (safeTaxPercent / 100);
      reportRows.push([
        '',
        'جمع کل با احتساب زمین و مالیات',
        '',
        '',
        '',
        Math.round(totalBase + totalBase * (safeTaxPercent / 100) + safeLandPrice),
        '',
        '',
        Math.round(totalEst + estTax + safeLandPrice),
        Math.round(
          totalEst + estTax - (totalBase + totalBase * (safeTaxPercent / 100))
        ),
      ]);
    }
  }

  if (
    typeof usefulAreaSqm === 'number' &&
    usefulAreaSqm > 0 &&
    safePartnership !== null
  ) {
    const builderUsefulArea = usefulAreaSqm * (safePartnership / 100);
    reportRows.push([
      '',
      `سود مشارکت — هزینه هر مترمربع سهم سازنده (${safePartnership}٪ معادل ${Number(builderUsefulArea.toFixed(2))} مترمربع)`,
      '',
      '',
      '',
      Math.round((totalBase + safeLandPrice) / builderUsefulArea),
      '',
      '',
      Math.round((totalEst + safeLandPrice) / builderUsefulArea),
      Math.round((totalEst - totalBase) / builderUsefulArea),
    ]);
  }

  const wsReport = XLSX.utils.aoa_to_sheet(reportRows);
  wsReport['!cols'] = [
    { wch: 8 },
    { wch: 36 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsReport, 'گزارش برآورد');

  // Sheet 2: Standard 5-column Base Expenses (re-importable!)
  const baseRows: (string | number)[][] = [[...EXCEL_STANDARD_HEADERS]];
  items.forEach((item) => {
    baseRows.push([
      item.categoryName,
      item.subcategory,
      item.dateJalali,
      item.title,
      item.baseAmount,
    ]);
  });
  const wsBase = XLSX.utils.aoa_to_sheet(baseRows);
  wsBase['!cols'] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 36 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsBase, 'هزینه‌های پایه استاندارد');

  if (versions && versions.length > 0) {
    const verRows: (string | number)[][] = [
      [
        'نام نسخه',
        'تاریخ نسخه',
        'مبنای محاسبه',
        'جمع پایه',
        'جمع برآورد',
        'درصد مالیات',
        'جمع کل با مالیات',
        'اختلاف مبلغی',
        'درصد اختلاف',
        'توضیحات',
      ],
    ];
    versions.forEach((v) => {
      const vTax = v.taxPercentSnapshot ?? 0;
      verRows.push([
        v.name,
        v.versionDateJalali,
        v.baseReferenceType === 'VERSION' && v.parentVersionName
          ? `نسخهٔ ${v.parentVersionName}`
          : 'قیمت پایه',
        v.totalBaseAmount,
        Math.round(v.totalEstimatedAmount),
        vTax,
        Math.round(v.totalEstimatedAmount * (1 + vTax / 100)),
        Math.round(v.diffFromBaseAmount),
        Number(v.diffFromBasePercent.toFixed(2)),
        v.description,
      ]);
    });
    const wsVersions = XLSX.utils.aoa_to_sheet(verRows);
    XLSX.utils.book_append_sheet(wb, wsVersions, 'سوابق نسخه‌ها');
  }

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
