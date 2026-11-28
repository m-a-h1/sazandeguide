import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVersionPayload,
  calculateProjectValuation,
  computeEffectiveRate,
  computeEstimatedAmount,
} from './pricing';
import { createClientSeedBundle, PDF_SAMPLE_EXPENSES } from '../data/pdfSeed';

test('PDF sample dataset totals verify each group and catch the 340,000,000 PDF subtotal discrepancy', () => {
  const sumByCategory = new Map<string, number>();
  let total = 0;
  for (const row of PDF_SAMPLE_EXPENSES) {
    total += row.baseAmount;
    sumByCategory.set(
      row.categoryName,
      (sumByCategory.get(row.categoryName) ?? 0) + row.baseAmount
    );
  }

  assert.equal(PDF_SAMPLE_EXPENSES.length, 86);
  assert.equal(sumByCategory.get('فروش و بازاریابی'), 250000000);
  assert.equal(sumByCategory.get('مالی و تسهیلات'), 23731267952);
  assert.equal(sumByCategory.get('اداری و تشکیلاتی'), 899327433);
  assert.equal(sumByCategory.get('حقوق و دستمزد'), 8513924768);
  // Row 39 (اجرای فوم بتن = 340,000,000) makes actual sum 84,320,884,590 vs printed 83,980,884,590
  assert.equal(sumByCategory.get('پیمان و اجرا'), 84320884590);
  assert.equal(sumByCategory.get('پیمان و اجرا')! - 83980884590, 340000000);
  assert.equal(sumByCategory.get('مواد و مصالح'), 190559325410);
  assert.equal(total, 308274730153);
  assert.equal(total - 307934730153, 340000000);
});

test('Mandatory override priority rule: independent rate replaces category rate (never adds)', () => {
  // مواد و مصالح = 5%, آهن و میلگرد independent = 10% => effective MUST be 10%, not 5% and not 15%
  const rebarRate = computeEffectiveRate(5, 10);
  assert.equal(rebarRate.effectivePercent, 10);
  assert.equal(rebarRate.rateSource, 'INDEPENDENT');

  // Removing independent override reverts to category rate (5%)
  const revertedRate = computeEffectiveRate(5, null);
  assert.equal(revertedRate.effectivePercent, 5);
  assert.equal(revertedRate.rateSource, 'CATEGORY');

  // Negative percentage allowed
  const discounted = computeEffectiveRate(-4, null);
  assert.equal(discounted.effectivePercent, -4);
  assert.equal(computeEstimatedAmount(1000, -4), 960);
});

test('Project valuation preserves base price and computes per-sqm and version snapshots immutably', () => {
  const { expenses } = createClientSeedBundle();
  const rebar = expenses.find((e) => e.title === 'آهن و میلگرد')!;
  const cement = expenses.find((e) => e.title.startsWith('سیمان'))!;

  const testExpenses = [
    { ...rebar, overridePercent: 10 },
    { ...cement, overridePercent: null },
  ];

  const val1 = calculateProjectValuation({
    expenses: testExpenses,
    categoryRates: { 'مواد و مصالح': 5 },
    areaSqm: 1000,
  });

  const rebarSnapshot = val1.items.find((i) => i.title === 'آهن و میلگرد')!;
  const cementSnapshot = val1.items.find((i) => i.title.startsWith('سیمان'))!;

  assert.equal(rebarSnapshot.effectivePercent, 10);
  assert.equal(rebarSnapshot.rateSource, 'INDEPENDENT');
  assert.equal(rebarSnapshot.estimatedAmount, rebar.baseAmount * 1.1);

  assert.equal(cementSnapshot.effectivePercent, 5);
  assert.equal(cementSnapshot.rateSource, 'CATEGORY');
  assert.equal(cementSnapshot.estimatedAmount, cement.baseAmount * 1.05);

  const v1Payload = buildVersionPayload({
    projectId: 1,
    name: 'برآورد مهر ۱۴۰۵',
    versionDateJalali: '1405/07/27',
    description: 'نسخه اول',
    expenses: testExpenses,
    categoryRates: { 'مواد و مصالح': 5 },
  });

  // Changing category rate afterwards must NOT alter v1Payload or baseAmount
  const val2 = calculateProjectValuation({
    expenses: testExpenses,
    categoryRates: { 'مواد و مصالح': 20 },
    areaSqm: 1000,
    referenceVersion: { ...v1Payload, id: 1 },
  });

  assert.equal(v1Payload.itemsSnapshot[1].effectivePercent, 5);
  assert.equal(v1Payload.totalBaseAmount, rebar.baseAmount + cement.baseAmount);
  // In val2 built from v1, rebar still uses its independent 10% on v1's estimated amount, and base total is unchanged
  assert.equal(val2.totalBaseAmount, v1Payload.totalBaseAmount);
  assert.equal(
    val2.items[0].estimatedAmount,
    v1Payload.itemsSnapshot[0].estimatedAmount * 1.1
  );
  assert.equal(
    val2.items[1].estimatedAmount,
    v1Payload.itemsSnapshot[1].estimatedAmount * 1.2
  );
});

test('Project-level tax percentage calculates tax and total-with-tax accurately and snapshots per version', () => {
  const { expenses } = createClientSeedBundle();
  const sample = expenses.slice(0, 1).map((e) => ({ ...e, baseAmount: 1000000, overridePercent: null }));

  const val = calculateProjectValuation({
    expenses: sample,
    categoryRates: { [sample[0].categoryName]: 20 },
    areaSqm: null,
    taxPercent: 10,
  });

  assert.equal(val.totalBaseAmount, 1000000);
  assert.equal(val.baseTaxAmount, 100000);
  assert.equal(val.totalBaseWithTax, 1100000);
  assert.equal(val.totalEstimatedAmount, 1200000);
  assert.equal(val.estimatedTaxAmount, 120000);
  assert.equal(val.totalEstimatedWithTax, 1320000);

  const v1 = buildVersionPayload({
    projectId: 1,
    name: 'نسخه با مالیات ۱۰٪',
    versionDateJalali: '1405/08/01',
    description: '',
    expenses: sample,
    categoryRates: { [sample[0].categoryName]: 20 },
    taxPercent: 10,
  });
  assert.equal(v1.taxPercentSnapshot, 10);
});

test('Per-sqm pricing calculates independently for total area and useful area', () => {
  const { expenses } = createClientSeedBundle();
  const sample = expenses
    .slice(0, 1)
    .map((e) => ({ ...e, baseAmount: 1000000000, overridePercent: null }));

  const val = calculateProjectValuation({
    expenses: sample,
    categoryRates: { [sample[0].categoryName]: 25 },
    areaSqm: 1000,
    usefulAreaSqm: 800,
  });

  assert.equal(val.basePerSqm, 1000000);
  assert.equal(val.estimatedPerSqm, 1250000);
  assert.equal(val.basePerUsefulSqm, 1250000);
  assert.equal(val.estimatedPerUsefulSqm, 1562500);

  const missingUseful = calculateProjectValuation({
    expenses: sample,
    categoryRates: {},
    areaSqm: 1000,
    usefulAreaSqm: null,
  });
  assert.equal(missingUseful.basePerSqm, 1000000);
  assert.equal(missingUseful.basePerUsefulSqm, null);
  assert.equal(missingUseful.estimatedPerUsefulSqm, null);
});

test('Land price and partnership share calculate pure vs land-inclusive costs and builder-share cost per sqm accurately', () => {
  const { expenses } = createClientSeedBundle();
  const sample = expenses
    .slice(0, 1)
    .map((e) => ({ ...e, baseAmount: 300000000, overridePercent: null }));

  const val = calculateProjectValuation({
    expenses: sample,
    categoryRates: {},
    areaSqm: 250,
    usefulAreaSqm: 200,
    taxPercent: 10,
    landPrice: 100000000,
    partnershipPercent: 50,
  });

  // Pure construction cost
  assert.equal(val.totalEstimatedAmount, 300000000);
  assert.equal(val.estimatedTaxAmount, 30000000);
  assert.equal(val.totalEstimatedWithTax, 330000000);
  assert.equal(val.estimatedPerUsefulSqm, 1500000);

  // Partnership & land metrics: builderUsefulArea = 200 * 50% = 100 sqm
  assert.equal(val.partnership.builderUsefulAreaSqm, 100);
  // Total with land = 300M + 100M = 400M => 400M / 100 = 4,000,000 per builder useful sqm
  assert.equal(val.partnership.totalEstimatedWithLand, 400000000);
  assert.equal(val.partnership.partnershipCostPerBuilderUsefulSqm, 4000000);
  // With tax (30M) + land (100M) = 430M => 4,300,000 per builder useful sqm
  assert.equal(val.partnership.totalEstimatedWithLandAndTax, 430000000);
  assert.equal(
    val.partnership.partnershipCostWithTaxPerBuilderUsefulSqm,
    4300000
  );
  // Pure construction cost per builder useful sqm = 300M / 100 = 3,000,000
  assert.equal(val.partnership.partnershipPureCostPerBuilderUsefulSqm, 3000000);

  // Version snapshot captures landPriceSnapshot and partnershipPercentSnapshot
  const v1 = buildVersionPayload({
    projectId: 1,
    name: 'نسخه مشارکت',
    versionDateJalali: '1405/08/10',
    description: '',
    expenses: sample,
    categoryRates: {},
    taxPercent: 10,
    landPrice: 100000000,
    partnershipPercent: 50,
  });
  assert.equal(v1.landPriceSnapshot, 100000000);
  assert.equal(v1.partnershipPercentSnapshot, 50);
});

test('Tag percentage adjustment applies to tagged expenses and respects independent override priority', () => {
  const { expenses } = createClientSeedBundle();
  const baseItem = expenses[0];
  const taggedItem1 = {
    ...baseItem,
    id: 101,
    baseAmount: 200000000,
    overridePercent: null,
    tagId: 5,
    tagName: 'میلگرد ۱۶',
  };
  const taggedItem2 = {
    ...baseItem,
    id: 102,
    baseAmount: 100000000,
    overridePercent: 30, // independent override must win over tag rate
    tagId: 5,
    tagName: 'میلگرد ۱۶',
  };
  const zeroTagItem = {
    ...baseItem,
    id: 103,
    baseAmount: 100000000,
    overridePercent: null,
    tagId: 6,
    tagName: 'سیمان',
  };

  const val = calculateProjectValuation({
    expenses: [taggedItem1, taggedItem2, zeroTagItem],
    categoryRates: { [baseItem.categoryName]: 5 },
    tagRatesById: { 5: 15, 6: 0 },
    areaSqm: 1000,
  });

  // taggedItem1 uses tag rate 15% => 230,000,000
  assert.equal(val.items[0].rateSource, 'TAG');
  assert.equal(val.items[0].effectivePercent, 15);
  assert.ok(Math.abs(val.items[0].estimatedAmount - 230000000) < 0.01);

  // taggedItem2 uses independent override 30% => 130,000,000
  assert.equal(val.items[1].rateSource, 'INDEPENDENT');
  assert.equal(val.items[1].effectivePercent, 30);
  assert.equal(val.items[1].estimatedAmount, 130000000);

  // zeroTagItem has tag percent 0 => falls back to category rate 5% => 105,000,000
  assert.equal(val.items[2].rateSource, 'CATEGORY');
  assert.equal(val.items[2].effectivePercent, 5);
  assert.equal(val.items[2].estimatedAmount, 105000000);
});



