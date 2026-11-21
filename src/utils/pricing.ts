import type {
  CategoryBreakdownItem,
  ExpenseItem,
  PartnershipValuationMetrics,
  PricingVersion,
  ProjectCurrency,
  ProjectValuation,
  VersionItemSnapshot,
} from '../types/app';
import { normalizeDigits, toPersianDigits } from './jalali';

/**
 * Computes effective rate with strict replacement priority:
 * - If expense has an independent overridePercent (not null/undefined), ONLY that overridePercent applies.
 * - Otherwise, the category rate applies.
 * - Never adds or multiplies category rate with independent override.
 */
export function computeEffectiveRate(
  categoryRate: number,
  overridePercent: number | null | undefined
): {
  effectivePercent: number;
  rateSource: 'CATEGORY' | 'INDEPENDENT';
} {
  if (
    overridePercent !== null &&
    overridePercent !== undefined &&
    Number.isFinite(overridePercent)
  ) {
    return {
      effectivePercent: overridePercent,
      rateSource: 'INDEPENDENT',
    };
  }
  return {
    effectivePercent: Number.isFinite(categoryRate) ? categoryRate : 0,
    rateSource: 'CATEGORY',
  };
}

/**
 * Exact valuation formula without premature rounding:
 * estimatedAmount = referenceAmount * (1 + effectivePercent / 100)
 */
export function computeEstimatedAmount(
  referenceAmount: number,
  effectivePercent: number
): number {
  return referenceAmount * (1 + effectivePercent / 100);
}

export function computePerSqm(
  amount: number,
  areaSqm: number | null | undefined
): number | null {
  if (
    typeof areaSqm !== 'number' ||
    !Number.isFinite(areaSqm) ||
    areaSqm <= 0
  ) {
    return null;
  }
  return amount / areaSqm;
}

export function computePartnershipMetrics(params: {
  pureBaseAmount: number;
  pureEstimatedAmount: number;
  taxPercent?: number;
  landPrice?: number;
  areaSqm: number | null | undefined;
  usefulAreaSqm: number | null | undefined;
  partnershipPercent: number | null | undefined;
}): PartnershipValuationMetrics {
  const {
    pureBaseAmount,
    pureEstimatedAmount,
    taxPercent = 0,
    landPrice = 0,
    areaSqm,
    usefulAreaSqm,
    partnershipPercent,
  } = params;

  const safeLand =
    typeof landPrice === 'number' && Number.isFinite(landPrice) && landPrice >= 0
      ? landPrice
      : 0;
  const safeTax =
    typeof taxPercent === 'number' && Number.isFinite(taxPercent) && taxPercent >= 0
      ? taxPercent
      : 0;
  const safePartnership =
    typeof partnershipPercent === 'number' &&
    Number.isFinite(partnershipPercent) &&
    partnershipPercent > 0 &&
    partnershipPercent <= 100
      ? partnershipPercent
      : null;

  const validUseful =
    typeof usefulAreaSqm === 'number' &&
    Number.isFinite(usefulAreaSqm) &&
    usefulAreaSqm > 0
      ? usefulAreaSqm
      : null;

  const builderUsefulAreaSqm =
    validUseful !== null && safePartnership !== null
      ? validUseful * (safePartnership / 100)
      : null;

  const totalBaseWithLand = pureBaseAmount + safeLand;
  const totalEstimatedWithLand = pureEstimatedAmount + safeLand;
  const estimatedTaxAmount = pureEstimatedAmount * (safeTax / 100);
  const totalEstimatedWithLandAndTax =
    pureEstimatedAmount + estimatedTaxAmount + safeLand;

  return {
    landPrice: safeLand,
    partnershipPercent: safePartnership,
    builderUsefulAreaSqm,
    totalBaseWithLand,
    totalEstimatedWithLand,
    totalEstimatedWithLandAndTax,
    basePerTotalSqmWithLand: computePerSqm(totalBaseWithLand, areaSqm),
    estimatedPerTotalSqmWithLand: computePerSqm(totalEstimatedWithLand, areaSqm),
    basePerUsefulSqmWithLand: computePerSqm(totalBaseWithLand, usefulAreaSqm),
    estimatedPerUsefulSqmWithLand: computePerSqm(
      totalEstimatedWithLand,
      usefulAreaSqm
    ),
    partnershipCostPerBuilderUsefulSqm: computePerSqm(
      totalEstimatedWithLand,
      builderUsefulAreaSqm
    ),
    partnershipCostWithTaxPerBuilderUsefulSqm: computePerSqm(
      totalEstimatedWithLandAndTax,
      builderUsefulAreaSqm
    ),
    partnershipPureCostPerBuilderUsefulSqm: computePerSqm(
      pureEstimatedAmount,
      builderUsefulAreaSqm
    ),
  };
}

export function calculateProjectValuation(params: {
  expenses: ExpenseItem[];
  categoryRates: Record<string, number>;
  areaSqm: number | null;
  usefulAreaSqm?: number | null;
  taxPercent?: number;
  landPrice?: number;
  partnershipPercent?: number | null;
  referenceVersion?: PricingVersion | null;
}): ProjectValuation {
  const {
    expenses,
    categoryRates,
    areaSqm,
    usefulAreaSqm = null,
    taxPercent = 0,
    landPrice = 0,
    partnershipPercent = null,
    referenceVersion,
  } = params;
  const safeTaxPercent =
    typeof taxPercent === 'number' && Number.isFinite(taxPercent) && taxPercent >= 0
      ? taxPercent
      : 0;

  const refItemsById = new Map<number, VersionItemSnapshot>();
  if (referenceVersion) {
    for (const item of referenceVersion.itemsSnapshot) {
      refItemsById.set(item.expenseId, item);
    }
  }

  let totalBaseAmount = 0;
  let totalReferenceAmount = 0;
  let totalEstimatedAmount = 0;

  const catTotals = new Map<
    string,
    { baseAmount: number; estimatedAmount: number; itemCount: number }
  >();

  const items: VersionItemSnapshot[] = expenses.map((exp) => {
    const categoryRateApplied = Number.isFinite(categoryRates[exp.categoryName])
      ? categoryRates[exp.categoryName]
      : 0;
    const { effectivePercent, rateSource } = computeEffectiveRate(
      categoryRateApplied,
      exp.overridePercent
    );

    const refSnapshot = referenceVersion
      ? refItemsById.get(exp.id)
      : undefined;
    const referenceAmount = refSnapshot
      ? refSnapshot.estimatedAmount
      : exp.baseAmount;

    const estimatedAmount = computeEstimatedAmount(
      referenceAmount,
      effectivePercent
    );
    const diffFromBaseAmount = estimatedAmount - exp.baseAmount;
    const diffFromBasePercent =
      exp.baseAmount > 0 ? (diffFromBaseAmount / exp.baseAmount) * 100 : 0;

    totalBaseAmount += exp.baseAmount;
    totalReferenceAmount += referenceAmount;
    totalEstimatedAmount += estimatedAmount;

    const existingCat = catTotals.get(exp.categoryName) ?? {
      baseAmount: 0,
      estimatedAmount: 0,
      itemCount: 0,
    };
    existingCat.baseAmount += exp.baseAmount;
    existingCat.estimatedAmount += estimatedAmount;
    existingCat.itemCount += 1;
    catTotals.set(exp.categoryName, existingCat);

    return {
      expenseId: exp.id,
      title: exp.title,
      categoryName: exp.categoryName,
      subcategory: exp.subcategory,
      dateJalali: exp.dateJalali,
      baseAmount: exp.baseAmount,
      referenceAmount,
      categoryRateApplied,
      overridePercent:
        rateSource === 'INDEPENDENT' ? (exp.overridePercent ?? null) : null,
      effectivePercent,
      rateSource,
      estimatedAmount,
      diffFromBaseAmount,
      diffFromBasePercent,
    };
  });

  const baseTaxAmount = totalBaseAmount * (safeTaxPercent / 100);
  const totalBaseWithTax = totalBaseAmount + baseTaxAmount;
  const estimatedTaxAmount = totalEstimatedAmount * (safeTaxPercent / 100);
  const totalEstimatedWithTax = totalEstimatedAmount + estimatedTaxAmount;

  const diffFromBaseAmount = totalEstimatedAmount - totalBaseAmount;
  const diffFromBasePercent =
    totalBaseAmount > 0 ? (diffFromBaseAmount / totalBaseAmount) * 100 : 0;

  const basePerSqm = computePerSqm(totalBaseAmount, areaSqm);
  const estimatedPerSqm = computePerSqm(totalEstimatedAmount, areaSqm);
  const basePerUsefulSqm = computePerSqm(totalBaseAmount, usefulAreaSqm);
  const estimatedPerUsefulSqm = computePerSqm(
    totalEstimatedAmount,
    usefulAreaSqm
  );

  const partnership = computePartnershipMetrics({
    pureBaseAmount: totalBaseAmount,
    pureEstimatedAmount: totalEstimatedAmount,
    taxPercent: safeTaxPercent,
    landPrice,
    areaSqm,
    usefulAreaSqm,
    partnershipPercent,
  });

  const categoryBreakdown: CategoryBreakdownItem[] = Array.from(
    catTotals.entries()
  )
    .map(([categoryName, data]) => ({
      categoryName,
      baseAmount: data.baseAmount,
      estimatedAmount: data.estimatedAmount,
      shareOfBasePercent:
        totalBaseAmount > 0 ? (data.baseAmount / totalBaseAmount) * 100 : 0,
      shareOfEstimatedPercent:
        totalEstimatedAmount > 0
          ? (data.estimatedAmount / totalEstimatedAmount) * 100
          : 0,
      itemCount: data.itemCount,
    }))
    .sort((a, b) => b.estimatedAmount - a.estimatedAmount);

  return {
    items,
    totalBaseAmount,
    totalReferenceAmount,
    totalEstimatedAmount,
    taxPercent: safeTaxPercent,
    baseTaxAmount,
    totalBaseWithTax,
    estimatedTaxAmount,
    totalEstimatedWithTax,
    diffFromBaseAmount,
    diffFromBasePercent,
    basePerSqm,
    estimatedPerSqm,
    basePerUsefulSqm,
    estimatedPerUsefulSqm,
    partnership,
    categoryBreakdown,
  };
}

export function buildVersionPayload(params: {
  projectId: number;
  name: string;
  versionDateJalali: string;
  description: string;
  expenses: ExpenseItem[];
  categoryRates: Record<string, number>;
  taxPercent?: number;
  landPrice?: number;
  partnershipPercent?: number | null;
  referenceVersion?: PricingVersion | null;
}): Omit<PricingVersion, 'id' | 'createdAt'> {
  const {
    projectId,
    name,
    versionDateJalali,
    description,
    expenses,
    categoryRates,
    taxPercent = 0,
    landPrice = 0,
    partnershipPercent = null,
    referenceVersion,
  } = params;

  const valuation = calculateProjectValuation({
    expenses,
    categoryRates,
    areaSqm: null,
    taxPercent,
    landPrice,
    partnershipPercent,
    referenceVersion,
  });

  return {
    projectId,
    name: name.trim(),
    versionDateJalali: normalizeDigits(versionDateJalali.trim()),
    description: description.trim(),
    baseReferenceType: referenceVersion ? 'VERSION' : 'BASE',
    parentVersionId: referenceVersion ? referenceVersion.id : null,
    parentVersionName: referenceVersion ? referenceVersion.name : null,
    categoryRatesSnapshot: { ...categoryRates },
    taxPercentSnapshot: valuation.taxPercent,
    landPriceSnapshot: valuation.partnership.landPrice,
    partnershipPercentSnapshot: valuation.partnership.partnershipPercent,
    totalBaseAmount: valuation.totalBaseAmount,
    totalReferenceAmount: valuation.totalReferenceAmount,
    totalEstimatedAmount: valuation.totalEstimatedAmount,
    diffFromBaseAmount: valuation.diffFromBaseAmount,
    diffFromBasePercent: valuation.diffFromBasePercent,
    itemsSnapshot: valuation.items.map((item) => ({ ...item })),
  };
}

export function formatNumberFa(
  value: number,
  options?: { maxDecimals?: number; showPlus?: boolean }
): string {
  if (!Number.isFinite(value)) return '۰';
  const maxDecimals = options?.maxDecimals ?? 0;
  const rounded =
    maxDecimals === 0
      ? Math.round(value)
      : Number(value.toFixed(maxDecimals));
  const isNeg = rounded < 0;
  const absVal = Math.abs(rounded);

  const [intPart, fracPart] = String(absVal).split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const combined = fracPart ? `${formattedInt}٫${fracPart}` : formattedInt;

  const sign = isNeg ? '−' : options?.showPlus && rounded > 0 ? '+' : '';
  return toPersianDigits(`${sign}${combined}`);
}

export function formatCurrencyValue(
  value: number,
  currency: ProjectCurrency
): string {
  const numStr = formatNumberFa(value, { maxDecimals: 0 });
  if (currency === 'تعیین‌نشده') {
    return numStr;
  }
  return `${numStr} ${currency}`;
}

export function formatPercentFa(
  value: number,
  options?: { showPlus?: boolean }
): string {
  if (!Number.isFinite(value)) return '۰٪';
  const rounded = Math.round(value * 100) / 100;
  const numStr = formatNumberFa(rounded, {
    maxDecimals: Number.isInteger(rounded) ? 0 : 2,
    showPlus: options?.showPlus,
  });
  return `${numStr}٪`;
}

export function parseStrictNumericInput(raw: string): number | null {
  const normalized = normalizeDigits(String(raw ?? '').trim());
  if (!normalized) return null;
  // Disallow commas, currency words, or letters if strict mode, or strip ASCII commas for manual entry helper
  const cleaned = normalized.replace(/٬|,/g, '').replace(/٫/g, '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}
