import type {
  ExpenseImageAttachment,
  ExpenseItem,
  ExpenseTag,
  ExpenseUnitType,
  ProjectCurrency,
  WeightUnit,
} from '../types/app';
import { compareJalaliDates } from './jalali';
import {
  computeEstimatedAmount,
  formatCurrencyValue,
  formatNumberFa,
} from './pricing';

export const UNIT_TYPE_OPTIONS: Array<{
  value: ExpenseUnitType;
  label: string;
  shortLabel: string;
}> = [
  { value: 'weight', label: 'وزنی (کیلوگرم / تن)', shortLabel: 'وزنی' },
  { value: 'count', label: 'تعدادی (عدد)', shortLabel: 'تعدادی' },
  { value: 'meter', label: 'متراژ (متر)', shortLabel: 'متراژ' },
  { value: 'service', label: 'خدمات / دستمزد', shortLabel: 'خدمات' },
];

export const WEIGHT_UNIT_OPTIONS: Array<{
  value: WeightUnit;
  label: string;
}> = [
  { value: 'kg', label: 'کیلوگرم' },
  { value: 'ton', label: 'تن' },
];

export function isExpenseUnitType(value: unknown): value is ExpenseUnitType {
  return (
    value === 'weight' ||
    value === 'count' ||
    value === 'meter' ||
    value === 'service'
  );
}

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'kg' || value === 'ton';
}

export function isDetailedExpense(expense: ExpenseItem): boolean {
  return (
    expense.entryMode === 'detailed' ||
    isExpenseUnitType(expense.unitType) ||
    expense.source === 'جزئیات'
  );
}

export function getUnitTypeLabel(unitType: ExpenseUnitType | null | undefined): string {
  switch (unitType) {
    case 'weight':
      return 'وزنی';
    case 'count':
      return 'تعدادی';
    case 'meter':
      return 'متراژ';
    case 'service':
      return 'خدمات';
    default:
      return 'عمومی';
  }
}

export function getWeightUnitLabel(weightUnit: WeightUnit | null | undefined): string {
  if (weightUnit === 'ton') return 'تن';
  if (weightUnit === 'kg') return 'کیلوگرم';
  return '';
}

export function getUnitPriceFieldLabel(
  unitType: ExpenseUnitType,
  weightUnit: WeightUnit | null
): string {
  switch (unitType) {
    case 'weight':
      return weightUnit === 'ton' ? 'قیمت هر تن' : 'قیمت هر کیلوگرم';
    case 'count':
      return 'قیمت هر عدد';
    case 'meter':
      return 'قیمت هر متر';
    case 'service':
      return 'مبلغ کل خدمت';
  }
}

/**
 * Authoritative total calculation:
 * - weight / count / meter: quantity * unitPrice (rounded to 2 decimal places)
 * - service: unitPrice directly as the whole lump-sum price
 */
export function computeDetailedExpenseTotal(input: {
  unitType: ExpenseUnitType;
  quantity: number | null;
  unitPrice: number;
}): number | null {
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
    return null;
  }
  if (input.unitType === 'service') {
    return Math.round(input.unitPrice * 100) / 100;
  }
  if (
    typeof input.quantity !== 'number' ||
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0
  ) {
    return null;
  }
  return Math.round(input.quantity * input.unitPrice * 100) / 100;
}

export interface ValidatedDetailedExpenseFields {
  entryMode: 'detailed';
  unitType: ExpenseUnitType;
  quantity: number | null;
  itemCount: number | null;
  weightUnit: WeightUnit | null;
  unitPrice: number;
  computedBaseAmount: number;
  description: string;
  images: ExpenseImageAttachment[];
}

export function sanitizeImageAttachments(
  raw: unknown
): ExpenseImageAttachment[] {
  if (!Array.isArray(raw)) return [];
  const clean: ExpenseImageAttachment[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const key = typeof obj.key === 'string' ? obj.key.trim() : '';
    const url = typeof obj.url === 'string' ? obj.url.trim() : '';
    const fileName =
      typeof obj.fileName === 'string' ? obj.fileName.trim().slice(0, 200) : 'image';
    const contentType =
      typeof obj.contentType === 'string' ? obj.contentType.trim() : 'image/jpeg';
    const size =
      typeof obj.size === 'number' && Number.isFinite(obj.size) && obj.size >= 0
        ? obj.size
        : 0;
    const uploadedAt =
      typeof obj.uploadedAt === 'string' && obj.uploadedAt.trim()
        ? obj.uploadedAt.trim()
        : new Date().toISOString();

    if (!key || !url) continue;
    // Only allow relative API paths or explicit http(s) URLs (never javascript:/data:)
    if (
      !url.startsWith('/api/') &&
      !url.startsWith('https://') &&
      !url.startsWith('http://')
    ) {
      continue;
    }

    clean.push({ key, url, fileName, contentType, size, uploadedAt });
  }
  return clean;
}

export interface DetailedExpenseValidationResult {
  valid: boolean;
  data?: ValidatedDetailedExpenseFields;
  error?: string;
}

export function validateDetailedExpenseInput(raw: {
  unitType: unknown;
  quantity?: unknown;
  itemCount?: unknown;
  weightUnit?: unknown;
  unitPrice: unknown;
  description?: unknown;
  images?: unknown;
}): DetailedExpenseValidationResult {
  if (!isExpenseUnitType(raw.unitType)) {
    return {
      valid: false,
      error: 'واحد اندازه‌گیری باید یکی از گزینه‌های وزنی، تعدادی، متراژ یا خدمات باشد.',
    };
  }

  const unitPrice = Number(raw.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return {
      valid: false,
      error:
        raw.unitType === 'service'
          ? 'مبلغ کل خدمت باید عددی معتبر و غیرمنفی باشد.'
          : 'قیمت واحد باید عددی معتبر و غیرمنفی باشد.',
    };
  }

  let quantity: number | null = null;
  if (raw.quantity !== null && raw.quantity !== undefined && raw.quantity !== '') {
    const parsedQty = Number(raw.quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return {
        valid: false,
        error: 'مقدار / تعداد باید عددی مثبت و بزرگ‌تر از صفر باشد.',
      };
    }
    quantity = parsedQty;
  }

  let itemCount: number | null = null;
  if (
    raw.unitType === 'weight' &&
    raw.itemCount !== null &&
    raw.itemCount !== undefined &&
    raw.itemCount !== ''
  ) {
    const parsedItemCount = Number(raw.itemCount);
    if (!Number.isFinite(parsedItemCount) || parsedItemCount <= 0) {
      return {
        valid: false,
        error: 'تعداد اختیاری باید عددی مثبت و بزرگ‌تر از صفر باشد.',
      };
    }
    itemCount = parsedItemCount;
  }

  let weightUnit: WeightUnit | null = null;
  if (raw.unitType === 'weight') {
    if (quantity === null) {
      return {
        valid: false,
        error: 'برای واحد وزنی، وارد کردن مقدار وزن الزامی است.',
      };
    }
    if (!isWeightUnit(raw.weightUnit)) {
      return {
        valid: false,
        error: 'برای واحد وزنی، انتخاب کیلوگرم یا تن الزامی است.',
      };
    }
    weightUnit = raw.weightUnit;
  } else if (raw.unitType === 'count') {
    if (quantity === null) {
      return {
        valid: false,
        error: 'برای واحد تعدادی، وارد کردن تعداد الزامی است.',
      };
    }
  } else if (raw.unitType === 'meter') {
    if (quantity === null) {
      return {
        valid: false,
        error: 'برای واحد متراژ، وارد کردن متراژ الزامی است.',
      };
    }
  }

  const computedBaseAmount = computeDetailedExpenseTotal({
    unitType: raw.unitType,
    quantity,
    unitPrice,
  });

  if (computedBaseAmount === null) {
    return {
      valid: false,
      error: 'امکان محاسبهٔ مبلغ کل با مقادیر واردشده وجود ندارد.',
    };
  }

  const description =
    typeof raw.description === 'string' ? raw.description.trim().slice(0, 2000) : '';
  const images = sanitizeImageAttachments(raw.images);

  return {
    valid: true,
    data: {
      entryMode: 'detailed',
      unitType: raw.unitType,
      quantity,
      itemCount,
      weightUnit,
      unitPrice,
      computedBaseAmount,
      description,
      images,
    },
  };
}

export function formatDetailedQuantity(expense: Pick<
  ExpenseItem,
  'unitType' | 'quantity' | 'weightUnit' | 'itemCount'
>): string {
  if (!expense.unitType) return '—';
  switch (expense.unitType) {
    case 'weight': {
      const qtyStr =
        typeof expense.quantity === 'number'
          ? formatNumberFa(expense.quantity, { maxDecimals: 3 })
          : '—';
      const unitLbl = getWeightUnitLabel(expense.weightUnit) || 'کیلوگرم';
      const base = `${qtyStr} ${unitLbl}`;
      if (typeof expense.itemCount === 'number' && expense.itemCount > 0) {
        return `${base} (${formatNumberFa(expense.itemCount, { maxDecimals: 2 })} عدد)`;
      }
      return base;
    }
    case 'count': {
      const qtyStr =
        typeof expense.quantity === 'number'
          ? formatNumberFa(expense.quantity, { maxDecimals: 2 })
          : '—';
      return `${qtyStr} عدد`;
    }
    case 'meter': {
      const qtyStr =
        typeof expense.quantity === 'number'
          ? formatNumberFa(expense.quantity, { maxDecimals: 2 })
          : '—';
      return `${qtyStr} متر`;
    }
    case 'service': {
      if (typeof expense.quantity === 'number' && expense.quantity > 0) {
        return `خدمات (${formatNumberFa(expense.quantity, { maxDecimals: 2 })} مورد)`;
      }
      return 'خدمات (مبلغ کل)';
    }
  }
}

export function formatDetailedCalculationSummary(
  expense: Pick<
    ExpenseItem,
    'unitType' | 'quantity' | 'weightUnit' | 'unitPrice' | 'itemCount'
  >,
  currency: ProjectCurrency
): string | null {
  if (!expense.unitType) return null;
  if (expense.unitType === 'service') {
    if (typeof expense.quantity === 'number' && expense.quantity > 0) {
      return `خدمات · ${formatNumberFa(expense.quantity, { maxDecimals: 2 })} مورد (مبلغ کل)`;
    }
    return 'خدمات · مبلغ کل';
  }
  if (expense.unitType === 'weight') {
    const baseWeight = formatDetailedQuantity({
      unitType: expense.unitType,
      quantity: expense.quantity,
      weightUnit: expense.weightUnit,
      itemCount: null,
    });
    const countNote =
      typeof expense.itemCount === 'number' && expense.itemCount > 0
        ? ` (${formatNumberFa(expense.itemCount, { maxDecimals: 2 })} عدد)`
        : '';
    if (typeof expense.unitPrice === 'number' && Number.isFinite(expense.unitPrice)) {
      return `${baseWeight} × ${formatCurrencyValue(expense.unitPrice, currency)}${countNote}`;
    }
    return `${baseWeight}${countNote}`;
  }
  const qtyText = formatDetailedQuantity(expense);
  if (typeof expense.unitPrice === 'number' && Number.isFinite(expense.unitPrice)) {
    return `${qtyText} × ${formatCurrencyValue(expense.unitPrice, currency)}`;
  }
  return qtyText;
}

export interface DetailedCategorySummary {
  categoryName: string;
  totalAmount: number;
  sharePercent: number;
  entryCount: number;
  detailedCount: number;
  generalCount: number;
  photoCount: number;
  totalWeightKg: number;
  totalMeters: number;
  totalCountItems: number;
  serviceCount: number;
}

export function aggregateDetailedCategorySummaries(
  expenses: ExpenseItem[],
  options?: { includeGeneral?: boolean }
): {
  totalAmount: number;
  totalEntries: number;
  totalPhotos: number;
  categories: DetailedCategorySummary[];
} {
  const includeGeneral = options?.includeGeneral ?? false;
  const scoped = includeGeneral
    ? expenses
    : expenses.filter((e) => isDetailedExpense(e));

  const map = new Map<
    string,
    {
      totalAmount: number;
      entryCount: number;
      detailedCount: number;
      generalCount: number;
      photoCount: number;
      totalWeightKg: number;
      totalMeters: number;
      totalCountItems: number;
      serviceCount: number;
    }
  >();

  let grandTotal = 0;
  let grandPhotos = 0;

  for (const exp of scoped) {
    const detailed = isDetailedExpense(exp);
    const photos = Array.isArray(exp.images) ? exp.images.length : 0;
    grandTotal += exp.baseAmount;
    grandPhotos += photos;

    const existing = map.get(exp.categoryName) ?? {
      totalAmount: 0,
      entryCount: 0,
      detailedCount: 0,
      generalCount: 0,
      photoCount: 0,
      totalWeightKg: 0,
      totalMeters: 0,
      totalCountItems: 0,
      serviceCount: 0,
    };

    existing.totalAmount += exp.baseAmount;
    existing.entryCount += 1;
    if (detailed) {
      existing.detailedCount += 1;
    } else {
      existing.generalCount += 1;
    }
    existing.photoCount += photos;

    if (exp.unitType === 'weight' && typeof exp.quantity === 'number') {
      existing.totalWeightKg +=
        exp.weightUnit === 'ton' ? exp.quantity * 1000 : exp.quantity;
    } else if (exp.unitType === 'meter' && typeof exp.quantity === 'number') {
      existing.totalMeters += exp.quantity;
    } else if (exp.unitType === 'count' && typeof exp.quantity === 'number') {
      existing.totalCountItems += exp.quantity;
    } else if (exp.unitType === 'service') {
      existing.serviceCount += 1;
    }

    map.set(exp.categoryName, existing);
  }

  const categories: DetailedCategorySummary[] = Array.from(map.entries())
    .map(([categoryName, data]) => ({
      categoryName,
      ...data,
      sharePercent: grandTotal > 0 ? (data.totalAmount / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    totalAmount: grandTotal,
    totalEntries: scoped.length,
    totalPhotos: grandPhotos,
    categories,
  };
}

export function formatAggregatedWeight(totalKg: number): string {
  if (!Number.isFinite(totalKg) || totalKg <= 0) return '';
  if (totalKg >= 1000) {
    return `${formatNumberFa(totalKg / 1000, { maxDecimals: 2 })} تن`;
  }
  return `${formatNumberFa(totalKg, { maxDecimals: 2 })} کیلوگرم`;
}

export interface TagValidationResult {
  valid: boolean;
  name?: string;
  percentAdjustment?: number;
  error?: string;
}

export function validateTagInput(
  rawName: unknown,
  rawPercent: unknown = 0
): TagValidationResult {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name || name.length < 2) {
    return {
      valid: false,
      error: 'نام برچسب باید حداقل ۲ کاراکتر باشد.',
    };
  }
  if (name.length > 80) {
    return {
      valid: false,
      error: 'نام برچسب نمی‌تواند بیشتر از ۸۰ کاراکتر باشد.',
    };
  }
  const percent =
    rawPercent === undefined || rawPercent === null || rawPercent === ''
      ? 0
      : Number(rawPercent);
  if (!Number.isFinite(percent) || percent < -100 || percent > 10000) {
    return {
      valid: false,
      error: 'درصد افزایش برچسب باید عددی بین ۱۰۰− تا ۱۰٬۰۰۰ باشد.',
    };
  }
  return {
    valid: true,
    name,
    percentAdjustment: Math.round(percent * 100) / 100,
  };
}

export function formatAverageUnitPriceValue(
  price: number,
  currency: ProjectCurrency
): string {
  if (!Number.isFinite(price)) return '۰';
  const maxDecimals =
    Math.abs(price) < 1000 && !Number.isInteger(price) ? 2 : 0;
  const numStr = formatNumberFa(price, { maxDecimals });
  if (currency === 'تعیین‌نشده') return numStr;
  return `${numStr} ${currency}`;
}

export interface WeightedTagPriceInfo {
  averageBasePrice: number | null;
  averageAdjustedPrice: number | null;
  unitLabel: string | null;
  totalNormalizedQuantity: number | null;
  isQuantityWeighted: boolean;
  averageBaseLabel: string;
  averageAdjustedLabel: string;
}

/**
 * Computes the volume/quantity-weighted average price for items grouped under a tag:
 * - Same physical unit (weight kg/ton, meter, count, or quantity-tracked service):
 *   sum(baseAmount) / sum(normalizedQuantity)
 * - Mixed or lump-sum service/general entries without uniform quantity:
 *   sum(baseAmount) / entryCount
 * Applies percentAdjustment directly onto the average price:
 *   averageAdjustedPrice = averageBasePrice * (1 + percentAdjustment / 100)
 */
export function computeWeightedTagPriceSummary(
  items: Array<
    Pick<
      ExpenseItem,
      'baseAmount' | 'unitType' | 'quantity' | 'weightUnit'
    >
  >,
  currency: ProjectCurrency,
  percentAdjustment = 0
): WeightedTagPriceInfo {
  if (items.length === 0) {
    return {
      averageBasePrice: null,
      averageAdjustedPrice: null,
      unitLabel: null,
      totalNormalizedQuantity: null,
      isQuantityWeighted: false,
      averageBaseLabel: '—',
      averageAdjustedLabel: '—',
    };
  }

  let totalBaseAmount = 0;
  for (const item of items) {
    if (Number.isFinite(item.baseAmount)) {
      totalBaseAmount += item.baseAmount;
    }
  }

  let averageBasePrice: number | null = null;
  let unitLabel: string | null = null;
  let totalNormalizedQuantity: number | null = null;
  let isQuantityWeighted = false;

  const allWeight = items.every(
    (i) =>
      i.unitType === 'weight' &&
      typeof i.quantity === 'number' &&
      Number.isFinite(i.quantity) &&
      i.quantity > 0
  );
  const allMeter = items.every(
    (i) =>
      i.unitType === 'meter' &&
      typeof i.quantity === 'number' &&
      Number.isFinite(i.quantity) &&
      i.quantity > 0
  );
  const allCount = items.every(
    (i) =>
      i.unitType === 'count' &&
      typeof i.quantity === 'number' &&
      Number.isFinite(i.quantity) &&
      i.quantity > 0
  );
  const allService = items.every((i) => i.unitType === 'service');

  if (allWeight) {
    const allTon = items.every((i) => i.weightUnit === 'ton');
    let sumQty = 0;
    for (const item of items) {
      const q = item.quantity ?? 0;
      sumQty += allTon
        ? q
        : item.weightUnit === 'ton'
          ? q * 1000
          : q;
    }
    if (sumQty > 0) {
      totalNormalizedQuantity = sumQty;
      unitLabel = allTon ? 'تن' : 'کیلوگرم';
      averageBasePrice = totalBaseAmount / sumQty;
      isQuantityWeighted = true;
    }
  } else if (allMeter) {
    let sumQty = 0;
    for (const item of items) {
      sumQty += item.quantity ?? 0;
    }
    if (sumQty > 0) {
      totalNormalizedQuantity = sumQty;
      unitLabel = 'متر';
      averageBasePrice = totalBaseAmount / sumQty;
      isQuantityWeighted = true;
    }
  } else if (allCount) {
    let sumQty = 0;
    for (const item of items) {
      sumQty += item.quantity ?? 0;
    }
    if (sumQty > 0) {
      totalNormalizedQuantity = sumQty;
      unitLabel = 'عدد';
      averageBasePrice = totalBaseAmount / sumQty;
      isQuantityWeighted = true;
    }
  } else if (allService) {
    const allServiceHaveQty = items.every(
      (i) =>
        typeof i.quantity === 'number' &&
        Number.isFinite(i.quantity) &&
        i.quantity > 0
    );
    if (allServiceHaveQty) {
      let sumQty = 0;
      for (const item of items) {
        sumQty += item.quantity ?? 0;
      }
      if (sumQty > 0) {
        totalNormalizedQuantity = sumQty;
        unitLabel = 'مورد';
        averageBasePrice = totalBaseAmount / sumQty;
        isQuantityWeighted = true;
      }
    } else {
      unitLabel = 'خدمت';
      averageBasePrice = totalBaseAmount / items.length;
      isQuantityWeighted = false;
    }
  } else {
    unitLabel = 'ردیف';
    averageBasePrice = totalBaseAmount / items.length;
    isQuantityWeighted = false;
  }

  const safePercent = Number.isFinite(percentAdjustment) ? percentAdjustment : 0;
  const averageAdjustedPrice =
    averageBasePrice !== null
      ? computeEstimatedAmount(averageBasePrice, safePercent)
      : null;

  const formatLine = (val: number | null) => {
    if (val === null || !Number.isFinite(val)) return '—';
    const priceStr = formatAverageUnitPriceValue(val, currency);
    return unitLabel ? `${priceStr} / ${unitLabel}` : priceStr;
  };

  return {
    averageBasePrice,
    averageAdjustedPrice,
    unitLabel,
    totalNormalizedQuantity,
    isQuantityWeighted,
    averageBaseLabel: formatLine(averageBasePrice),
    averageAdjustedLabel: formatLine(averageAdjustedPrice),
  };
}

export interface DetailedTagGroup {
  tagId: number;
  tagName: string;
  percentAdjustment: number;
  items: ExpenseItem[];
  entryCount: number;
  photoCount: number;
  totalBaseAmount: number;
  totalAdjustedAmount: number;
  quantitySummary: string;
  unitPriceSummary: string;
  weightedPrice: WeightedTagPriceInfo;
  categoriesLabel: string;
  latestDateJalali: string;
}

export function groupDetailedExpensesByTag(
  expenses: ExpenseItem[],
  tags: ExpenseTag[],
  currency: ProjectCurrency
): {
  tagGroups: DetailedTagGroup[];
  untaggedItems: ExpenseItem[];
} {
  const tagsById = new Map<number, ExpenseTag>();
  for (const tag of tags) {
    tagsById.set(tag.id, tag);
  }

  const groupedMap = new Map<number, ExpenseItem[]>();
  const untaggedItems: ExpenseItem[] = [];

  for (const exp of expenses) {
    if (typeof exp.tagId === 'number' && exp.tagId > 0) {
      const list = groupedMap.get(exp.tagId);
      if (list) {
        list.push(exp);
      } else {
        groupedMap.set(exp.tagId, [exp]);
      }
    } else {
      untaggedItems.push(exp);
    }
  }

  const tagGroups: DetailedTagGroup[] = [];

  for (const [tagId, items] of groupedMap.entries()) {
    const tagMeta = tagsById.get(tagId);
    const tagName = tagMeta?.name || items[0]?.tagName || `برچسب #${tagId}`;
    const percentAdjustment =
      typeof tagMeta?.percentAdjustment === 'number' &&
      Number.isFinite(tagMeta.percentAdjustment)
        ? tagMeta.percentAdjustment
        : 0;

    let totalBaseAmount = 0;
    let photoCount = 0;
    let totalWeightKg = 0;
    let totalMeters = 0;
    let totalCount = 0;
    let serviceItems = 0;
    const categories = new Set<string>();
    let latestDateJalali = items[0]?.dateJalali ?? '';

    const sortedItems = [...items].sort((a, b) => b.id - a.id);

    for (const item of sortedItems) {
      totalBaseAmount += item.baseAmount;
      photoCount += Array.isArray(item.images) ? item.images.length : 0;
      if (item.categoryName) categories.add(item.categoryName);
      if (
        item.dateJalali &&
        (!latestDateJalali ||
          compareJalaliDates(item.dateJalali, latestDateJalali) > 0)
      ) {
        latestDateJalali = item.dateJalali;
      }

      if (item.unitType === 'weight' && typeof item.quantity === 'number') {
        totalWeightKg +=
          item.weightUnit === 'ton' ? item.quantity * 1000 : item.quantity;
      } else if (
        item.unitType === 'meter' &&
        typeof item.quantity === 'number'
      ) {
        totalMeters += item.quantity;
      } else if (
        item.unitType === 'count' &&
        typeof item.quantity === 'number'
      ) {
        totalCount += item.quantity;
      } else if (item.unitType === 'service') {
        serviceItems += 1;
      }
    }

    const quantityParts: string[] = [];
    if (totalWeightKg > 0) {
      quantityParts.push(formatAggregatedWeight(totalWeightKg));
    }
    if (totalMeters > 0) {
      quantityParts.push(
        `${formatNumberFa(totalMeters, { maxDecimals: 2 })} متر`
      );
    }
    if (totalCount > 0) {
      quantityParts.push(
        `${formatNumberFa(totalCount, { maxDecimals: 2 })} عدد`
      );
    }
    if (serviceItems > 0) {
      quantityParts.push(`${formatNumberFa(serviceItems)} خدمت`);
    }

    const weightedPrice = computeWeightedTagPriceSummary(
      sortedItems,
      currency,
      percentAdjustment
    );
    const unitPriceSummary =
      weightedPrice.averageBasePrice !== null
        ? `میانگین ${weightedPrice.averageBaseLabel}`
        : '—';

    const totalAdjustedAmount = computeEstimatedAmount(
      totalBaseAmount,
      percentAdjustment
    );

    tagGroups.push({
      tagId,
      tagName,
      percentAdjustment,
      items: sortedItems,
      entryCount: sortedItems.length,
      photoCount,
      totalBaseAmount,
      totalAdjustedAmount,
      quantitySummary:
        quantityParts.length > 0 ? quantityParts.join(' / ') : '—',
      unitPriceSummary,
      weightedPrice,
      categoriesLabel: Array.from(categories).join('، ') || '—',
      latestDateJalali,
    });
  }

  tagGroups.sort((a, b) => b.totalAdjustedAmount - a.totalAdjustedAmount);
  untaggedItems.sort((a, b) => b.id - a.id);

  return { tagGroups, untaggedItems };
}
