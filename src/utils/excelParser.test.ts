import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  createSampleTemplateWorkbook,
  inspectSheet,
  readWorkbookFromArrayBuffer,
  validateMappedExcelRows,
  validateStrictExcelAmount,
} from './excelParser';

test('Sample template workbook passes strict 5-column inspection and validation', () => {
  const bytes = createSampleTemplateWorkbook();
  const wb = readWorkbookFromArrayBuffer(bytes.buffer as ArrayBuffer);
  assert.equal(wb.SheetNames.length, 1);

  const inspection = inspectSheet(wb, wb.SheetNames[0]);
  assert.equal(inspection.exactOrderMatch, true);
  assert.equal(inspection.exactHeaderMatch, true);
  assert.equal(inspection.hasExtraColumns, false);

  const summary = validateMappedExcelRows(inspection, inspection.suggestedMapping);
  assert.equal(summary.structuralErrors.length, 0);
  assert.equal(summary.invalidRows.length, 0);
  assert.equal(summary.validRows.length, 7);
});

test('Strict amount validation rejects currency words, commas, formulas, and letters', () => {
  assert.equal(validateStrictExcelAmount('18010058501').valid, true);
  assert.equal(validateStrictExcelAmount('18,010,058,501').valid, false);
  assert.equal(validateStrictExcelAmount('18010058501 تومان').valid, false);
  assert.equal(validateStrictExcelAmount('=SUM(A1:A2)').valid, false);
  assert.equal(validateStrictExcelAmount('').valid, false);
});

test('Excel parser detects extra columns, skips summary rows, and reports invalid dates/amounts in Persian', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['دسته اصلی', 'زیردسته / بخش', 'تاریخ هزینه', 'نام هزینه', 'مبلغ پایه', 'ستون اضافه'],
    ['مواد و مصالح', 'سازه و اسکلت', '1405/07/27', 'آهن و میلگرد', '18010058501', 'اضافی'],
    ['مواد و مصالح', 'سازه و اسکلت', 'امروز', 'بتن آماده', '8210670130', ''],
    ['پیمان و اجرا', 'سفت‌کاری', '1405/07/27', 'جمع کل', '26220728631', ''],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'برگه۱');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const loaded = readWorkbookFromArrayBuffer(bytes);
  const inspection = inspectSheet(loaded, 'برگه۱');
  assert.equal(inspection.hasExtraColumns, true);
  assert.ok(inspection.extraColumnsWarning);

  const summary = validateMappedExcelRows(inspection, inspection.suggestedMapping);
  assert.equal(summary.validRows.length, 1);
  assert.equal(summary.invalidRows.length, 1);
  assert.equal(summary.ignoredSummaryRows.length, 1);
  assert.equal(summary.totalValidAmount, 18010058501);
});
