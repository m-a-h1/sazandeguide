import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExpenseItem, ExpenseTag } from '../types/app';
import {
  aggregateDetailedCategorySummaries,
  computeDetailedExpenseTotal,
  computeWeightedTagPriceSummary,
  formatAggregatedWeight,
  formatDetailedCalculationSummary,
  formatDetailedQuantity,
  groupDetailedExpensesByTag,
  isDetailedExpense,
  validateDetailedExpenseInput,
  validateTagInput,
} from './detailedExpense';
import { calculateProjectValuation } from './pricing';

test('computeDetailedExpenseTotal calculates quantity x unitPrice for weight, count, meter and whole price for service', () => {
  assert.equal(
    computeDetailedExpenseTotal({
      unitType: 'weight',
      quantity: 12.5,
      unitPrice: 38000000,
    }),
    475000000
  );

  assert.equal(
    computeDetailedExpenseTotal({
      unitType: 'count',
      quantity: 40,
      unitPrice: 250000,
    }),
    10000000
  );

  assert.equal(
    computeDetailedExpenseTotal({
      unitType: 'meter',
      quantity: 120.5,
      unitPrice: 1000000,
    }),
    120500000
  );

  // Service uses unitPrice directly as the whole lump-sum price regardless of optional count
  assert.equal(
    computeDetailedExpenseTotal({
      unitType: 'service',
      quantity: null,
      unitPrice: 85000000,
    }),
    85000000
  );
  assert.equal(
    computeDetailedExpenseTotal({
      unitType: 'service',
      quantity: 3,
      unitPrice: 85000000,
    }),
    85000000
  );
});

test('validateDetailedExpenseInput enforces unit-specific requirements accurately', () => {
  // Weight requires quantity and kg/ton
  const missingWeightUnit = validateDetailedExpenseInput({
    unitType: 'weight',
    quantity: 5,
    weightUnit: null,
    unitPrice: 100000,
  });
  assert.equal(missingWeightUnit.valid, false);

  const validWeightTon = validateDetailedExpenseInput({
    unitType: 'weight',
    quantity: 3.5,
    weightUnit: 'ton',
    unitPrice: 40000000,
    description: 'میلگرد ۱۶ اصفهان',
  });
  assert.equal(validWeightTon.valid, true);
  if (validWeightTon.valid) {
    assert.equal(validWeightTon.data.computedBaseAmount, 140000000);
    assert.equal(validWeightTon.data.weightUnit, 'ton');
  }

  // Count requires positive count
  const missingCount = validateDetailedExpenseInput({
    unitType: 'count',
    quantity: null,
    unitPrice: 50000,
  });
  assert.equal(missingCount.valid, false);

  const validCount = validateDetailedExpenseInput({
    unitType: 'count',
    quantity: 25,
    unitPrice: 400000,
  });
  assert.equal(validCount.valid, true);
  if (validCount.valid) {
    assert.equal(validCount.data.computedBaseAmount, 10000000);
    assert.equal(validCount.data.weightUnit, null);
  }

  // Meter requires positive quantity
  const missingMeter = validateDetailedExpenseInput({
    unitType: 'meter',
    quantity: 0,
    unitPrice: 500000,
  });
  assert.equal(missingMeter.valid, false);

  // Service does NOT require count and uses whole price
  const validServiceNoCount = validateDetailedExpenseInput({
    unitType: 'service',
    quantity: null,
    unitPrice: 65000000,
    description: 'دستمزد کامل آرماتوربندی طبقه دوم',
  });
  assert.equal(validServiceNoCount.valid, true);
  if (validServiceNoCount.valid) {
    assert.equal(validServiceNoCount.data.computedBaseAmount, 65000000);
    assert.equal(validServiceNoCount.data.quantity, null);
  }

  // Image sanitizer blocks unsafe javascript: URLs
  const withUnsafeImage = validateDetailedExpenseInput({
    unitType: 'service',
    unitPrice: 10000,
    images: [
      {
        key: 'projects/1/expenses/ok.jpg',
        url: '/api/projects/1/uploads?key=projects%2F1%2Fexpenses%2Fok.jpg',
        fileName: 'ok.jpg',
        contentType: 'image/jpeg',
        size: 1200,
        uploadedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        key: 'bad',
        url: 'javascript:alert(1)',
        fileName: 'bad.jpg',
        contentType: 'image/jpeg',
        size: 10,
        uploadedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
  assert.equal(withUnsafeImage.valid, true);
  if (withUnsafeImage.valid) {
    assert.equal(withUnsafeImage.data.images.length, 1);
    assert.equal(withUnsafeImage.data.images[0].fileName, 'ok.jpg');
  }
});

test('aggregateDetailedCategorySummaries rolls up detailed entries and integrates with general calculateProjectValuation', () => {
  const expenses: ExpenseItem[] = [
    {
      id: 1,
      projectId: 10,
      categoryId: 1,
      categoryName: 'مواد و مصالح',
      subcategory: 'اسکلت',
      dateJalali: '1405/08/01',
      title: 'میلگرد ۱۶',
      baseAmount: 400000000,
      overridePercent: null,
      source: 'جزئیات',
      entryMode: 'detailed',
      unitType: 'weight',
      quantity: 10,
      weightUnit: 'ton',
      unitPrice: 40000000,
      description: 'فاکتور شماره ۱۲',
      images: [
        {
          key: 'projects/10/expenses/1.jpg',
          url: '/api/projects/10/uploads?key=projects%2F10%2Fexpenses%2F1.jpg',
          fileName: 'invoice.jpg',
          contentType: 'image/jpeg',
          size: 50000,
          uploadedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
    {
      id: 2,
      projectId: 10,
      categoryId: 1,
      categoryName: 'مواد و مصالح',
      subcategory: 'اسکلت',
      dateJalali: '1405/08/02',
      title: 'سیم آرماتوربندی',
      baseAmount: 50000000,
      overridePercent: null,
      source: 'جزئیات',
      entryMode: 'detailed',
      unitType: 'weight',
      quantity: 500,
      weightUnit: 'kg',
      unitPrice: 100000,
      description: '',
      images: [],
    },
    {
      id: 3,
      projectId: 10,
      categoryId: 2,
      categoryName: 'پیمان و اجرا',
      subcategory: 'سفت‌کاری',
      dateJalali: '1405/08/03',
      title: 'دستمزد اسکلت‌بندی',
      baseAmount: 150000000,
      overridePercent: null,
      source: 'جزئیات',
      entryMode: 'detailed',
      unitType: 'service',
      quantity: null,
      weightUnit: null,
      unitPrice: 150000000,
      description: 'مرحله اول',
      images: [],
    },
    {
      id: 4,
      projectId: 10,
      categoryId: 2,
      categoryName: 'پیمان و اجرا',
      subcategory: 'تأسیسات',
      dateJalali: '1405/08/04',
      title: 'ردیف عمومی اکسل',
      baseAmount: 200000000,
      overridePercent: null,
      source: 'اکسل',
      entryMode: 'general',
    },
  ];

  assert.equal(isDetailedExpense(expenses[0]), true);
  assert.equal(isDetailedExpense(expenses[3]), false);

  // Detailed-only summary
  const detailedOnly = aggregateDetailedCategorySummaries(expenses, {
    includeGeneral: false,
  });
  assert.equal(detailedOnly.totalEntries, 3);
  assert.equal(detailedOnly.totalAmount, 600000000);
  assert.equal(detailedOnly.totalPhotos, 1);
  assert.equal(detailedOnly.categories.length, 2);
  assert.equal(detailedOnly.categories[0].categoryName, 'مواد و مصالح');
  assert.equal(detailedOnly.categories[0].totalAmount, 450000000);
  assert.equal(detailedOnly.categories[0].sharePercent, 75);
  assert.equal(detailedOnly.categories[0].totalWeightKg, 10500);
  assert.equal(formatAggregatedWeight(detailedOnly.categories[0].totalWeightKg), '۱۰٫۵ تن');

  // Combined summary (general + detailed)
  const combined = aggregateDetailedCategorySummaries(expenses, {
    includeGeneral: true,
  });
  assert.equal(combined.totalEntries, 4);
  assert.equal(combined.totalAmount, 800000000);

  // General valuation rolls up all detailed + general expenses seamlessly
  const valuation = calculateProjectValuation({
    expenses,
    categoryRates: { 'مواد و مصالح': 10, 'پیمان و اجرا': 0 },
    areaSqm: 1000,
  });
  assert.equal(valuation.totalBaseAmount, 800000000);
  assert.equal(valuation.totalEstimatedAmount, 845000000);
  assert.equal(valuation.categoryBreakdown.length, 2);
});

test('Formatting helpers render clean Persian unit labels and calculation strings', () => {
  assert.equal(
    formatDetailedQuantity({ unitType: 'weight', quantity: 5.5, weightUnit: 'ton' }),
    '۵٫۵ تن'
  );
  assert.equal(
    formatDetailedQuantity({ unitType: 'count', quantity: 12, weightUnit: null }),
    '۱۲ عدد'
  );
  assert.equal(
    formatDetailedQuantity({ unitType: 'meter', quantity: 80, weightUnit: null }),
    '۸۰ متر'
  );
  assert.equal(
    formatDetailedQuantity({ unitType: 'service', quantity: null, weightUnit: null }),
    'خدمات (مبلغ کل)'
  );
  assert.equal(
    formatDetailedCalculationSummary(
      { unitType: 'count', quantity: 10, weightUnit: null, unitPrice: 50000 },
      'تومان'
    ),
    '۱۰ عدد × ۵۰٬۰۰۰ تومان'
  );
});

test('validateTagInput enforces tag name length and valid percentage bounds', () => {
  assert.equal(validateTagInput('ا', 0).valid, false);
  assert.equal(validateTagInput('میلگرد ۱۶', 15).valid, true);
  assert.equal(validateTagInput('میلگرد ۱۶', -150).valid, false);
  const res = validateTagInput('  بتن آماده  ', 12.5);
  assert.equal(res.valid, true);
  assert.equal(res.name, 'بتن آماده');
  assert.equal(res.percentAdjustment, 12.5);
});

test('groupDetailedExpensesByTag combines entries under the same tag row and applies tag percentage', () => {
  const tags: ExpenseTag[] = [
    { id: 10, projectId: 1, name: 'میلگرد ۱۶', percentAdjustment: 20 },
  ];
  const items: ExpenseItem[] = [
    {
      id: 1,
      projectId: 1,
      categoryId: 1,
      categoryName: 'مواد و مصالح',
      subcategory: 'اسکلت',
      dateJalali: '1405/08/01',
      title: 'خرید نوبت اول میلگرد',
      baseAmount: 350000000,
      overridePercent: null,
      source: 'جزئیات',
      entryMode: 'detailed',
      unitType: 'weight',
      quantity: 10,
      weightUnit: 'ton',
      unitPrice: 35000000,
      tagId: 10,
      tagName: 'میلگرد ۱۶',
    },
    {
      id: 2,
      projectId: 1,
      categoryId: 1,
      categoryName: 'مواد و مصالح',
      subcategory: 'اسکلت',
      dateJalali: '1405/08/05',
      title: 'خرید نوبت دوم میلگرد',
      baseAmount: 210000000,
      overridePercent: null,
      source: 'جزئیات',
      entryMode: 'detailed',
      unitType: 'weight',
      quantity: 5,
      weightUnit: 'ton',
      unitPrice: 42000000,
      tagId: 10,
      tagName: 'میلگرد ۱۶',
    },
    {
      id: 3,
      projectId: 1,
      categoryId: 2,
      categoryName: 'پیمان و اجرا',
      subcategory: 'سفت‌کاری',
      dateJalali: '1405/08/06',
      title: 'خاکبرداری بدون برچسب',
      baseAmount: 90000000,
      overridePercent: null,
      source: 'جزئیات',
      entryMode: 'detailed',
      unitType: 'service',
      quantity: null,
      weightUnit: null,
      unitPrice: 90000000,
      tagId: null,
      tagName: '',
    },
  ];

  const grouped = groupDetailedExpensesByTag(items, tags, 'تومان');
  assert.equal(grouped.tagGroups.length, 1);
  assert.equal(grouped.untaggedItems.length, 1);

  const g = grouped.tagGroups[0];
  assert.equal(g.tagName, 'میلگرد ۱۶');
  assert.equal(g.entryCount, 2);
  assert.equal(g.totalBaseAmount, 560000000);
  assert.equal(g.percentAdjustment, 20);
  assert.equal(g.totalAdjustedAmount, 672000000);
  assert.equal(g.quantitySummary, '۱۵ تن');
  // Volume-weighted average: (10*35M + 5*42M) / 15 = 560M / 15
  assert.equal(g.weightedPrice.isQuantityWeighted, true);
  assert.equal(g.weightedPrice.unitLabel, 'تن');
  assert.equal(g.weightedPrice.totalNormalizedQuantity, 15);
  assert.ok(Math.abs((g.weightedPrice.averageBasePrice ?? 0) - 560000000 / 15) < 0.01);
  // 20% tag adjustment applied on weighted average: (560M / 15) * 1.2 = 44,800,000
  assert.ok(Math.abs((g.weightedPrice.averageAdjustedPrice ?? 0) - 44800000) < 0.01);
  assert.ok(g.unitPriceSummary.includes('میانگین '));
  assert.equal(g.latestDateJalali, '1405/08/05');
});

test('computeWeightedTagPriceSummary handles mixed kg/ton, meter, count, and service entries accurately', () => {
  // Mixed kg + ton normalizes to kg: (500 * 30,000 + 2 * 35,000,000) / (500 + 2,000) = 85,000,000 / 2,500 = 34,000/kg
  const mixedWeight = computeWeightedTagPriceSummary(
    [
      { baseAmount: 15000000, unitType: 'weight', quantity: 500, weightUnit: 'kg' },
      { baseAmount: 70000000, unitType: 'weight', quantity: 2, weightUnit: 'ton' },
    ],
    'تومان',
    10
  );
  assert.equal(mixedWeight.isQuantityWeighted, true);
  assert.equal(mixedWeight.unitLabel, 'کیلوگرم');
  assert.equal(mixedWeight.totalNormalizedQuantity, 2500);
  assert.equal(mixedWeight.averageBasePrice, 34000);
  assert.ok(Math.abs((mixedWeight.averageAdjustedPrice ?? 0) - 37400) < 0.01);

  // Meter weighted average: (100*200k + 300*240k) / 400 = 92,000,000 / 400 = 230,000/m
  const meterAvg = computeWeightedTagPriceSummary(
    [
      { baseAmount: 20000000, unitType: 'meter', quantity: 100, weightUnit: null },
      { baseAmount: 72000000, unitType: 'meter', quantity: 300, weightUnit: null },
    ],
    'تومان',
    -5
  );
  assert.equal(meterAvg.unitLabel, 'متر');
  assert.equal(meterAvg.averageBasePrice, 230000);
  assert.ok(Math.abs((meterAvg.averageAdjustedPrice ?? 0) - 218500) < 0.01);

  // Lump-sum service without quantities averages across entries and applies tag percentage
  const serviceAvg = computeWeightedTagPriceSummary(
    [
      { baseAmount: 100000000, unitType: 'service', quantity: null, weightUnit: null },
      { baseAmount: 140000000, unitType: 'service', quantity: null, weightUnit: null },
    ],
    'تومان',
    15
  );
  assert.equal(serviceAvg.isQuantityWeighted, false);
  assert.equal(serviceAvg.unitLabel, 'خدمت');
  assert.equal(serviceAvg.averageBasePrice, 120000000);
  assert.ok(Math.abs((serviceAvg.averageAdjustedPrice ?? 0) - 138000000) < 0.01);
});

test('Weight detailed entries accept optional itemCount without altering weight x unitPrice total', () => {
  const validWithCount = validateDetailedExpenseInput({
    unitType: 'weight',
    quantity: 2.5,
    itemCount: 40,
    weightUnit: 'ton',
    unitPrice: 40000000,
  });
  assert.equal(validWithCount.valid, true);
  if (validWithCount.valid && validWithCount.data) {
    assert.equal(validWithCount.data.itemCount, 40);
    assert.equal(validWithCount.data.computedBaseAmount, 100000000);
  }

  const invalidZeroCount = validateDetailedExpenseInput({
    unitType: 'weight',
    quantity: 2.5,
    itemCount: 0,
    weightUnit: 'ton',
    unitPrice: 40000000,
  });
  assert.equal(invalidZeroCount.valid, false);

  assert.equal(
    formatDetailedQuantity({
      unitType: 'weight',
      quantity: 2.5,
      weightUnit: 'ton',
      itemCount: 40,
    }),
    '۲٫۵ تن (۴۰ عدد)'
  );

  assert.equal(
    formatDetailedCalculationSummary(
      {
        unitType: 'weight',
        quantity: 2.5,
        weightUnit: 'ton',
        unitPrice: 40000000,
        itemCount: 40,
      },
      'تومان'
    ),
    '۲٫۵ تن × ۴۰٬۰۰۰٬۰۰۰ تومان (۴۰ عدد)'
  );
});
