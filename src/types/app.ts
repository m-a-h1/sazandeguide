export type ProjectStatus = 'در حال ساخت' | 'تکمیل‌شده' | 'متوقف‌شده';

export type ProjectCurrency = 'تعیین‌نشده' | 'تومان' | 'ریال';

export interface Project {
  id: number;
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
  pdfAuditNote: string;
  draftCategoryRates: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryItem {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number;
  subcategories: string[];
}

export type ExpenseEntryMode = 'general' | 'detailed';

export type ExpenseUnitType = 'weight' | 'count' | 'meter' | 'service';

export type WeightUnit = 'kg' | 'ton';

export interface ExpenseImageAttachment {
  key: string;
  url: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface ExpenseTag {
  id: number;
  projectId: number;
  name: string;
  percentAdjustment: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseItem {
  id: number;
  projectId: number;
  categoryId: number | null;
  categoryName: string;
  subcategory: string;
  dateJalali: string;
  title: string;
  baseAmount: number;
  overridePercent: number | null;
  source: 'دستی' | 'اکسل' | 'نمونه' | 'جزئیات';
  entryMode?: ExpenseEntryMode;
  unitType?: ExpenseUnitType | null;
  quantity?: number | null;
  itemCount?: number | null;
  weightUnit?: WeightUnit | null;
  unitPrice?: number | null;
  description?: string;
  images?: ExpenseImageAttachment[];
  tagId?: number | null;
  tagName?: string;
}

export interface VersionItemSnapshot {
  expenseId: number;
  title: string;
  categoryName: string;
  subcategory: string;
  dateJalali: string;
  baseAmount: number;
  referenceAmount: number;
  categoryRateApplied: number;
  overridePercent: number | null;
  effectivePercent: number;
  rateSource: 'CATEGORY' | 'TAG' | 'INDEPENDENT';
  tagId?: number | null;
  tagName?: string;
  estimatedAmount: number;
  diffFromBaseAmount: number;
  diffFromBasePercent: number;
}

export interface PricingVersion {
  id: number;
  projectId: number;
  name: string;
  versionDateJalali: string;
  description: string;
  baseReferenceType: 'BASE' | 'VERSION';
  parentVersionId: number | null;
  parentVersionName: string | null;
  categoryRatesSnapshot: Record<string, number>;
  taxPercentSnapshot: number;
  landPriceSnapshot: number;
  partnershipPercentSnapshot: number | null;
  totalBaseAmount: number;
  totalReferenceAmount: number;
  totalEstimatedAmount: number;
  diffFromBaseAmount: number;
  diffFromBasePercent: number;
  itemsSnapshot: VersionItemSnapshot[];
  createdAt?: string;
}

export interface CategoryBreakdownItem {
  categoryName: string;
  baseAmount: number;
  estimatedAmount: number;
  shareOfBasePercent: number;
  shareOfEstimatedPercent: number;
  itemCount: number;
}

export interface PartnershipValuationMetrics {
  landPrice: number;
  partnershipPercent: number | null;
  builderUsefulAreaSqm: number | null;
  totalBaseWithLand: number;
  totalEstimatedWithLand: number;
  totalEstimatedWithLandAndTax: number;
  basePerTotalSqmWithLand: number | null;
  estimatedPerTotalSqmWithLand: number | null;
  basePerUsefulSqmWithLand: number | null;
  estimatedPerUsefulSqmWithLand: number | null;
  partnershipCostPerBuilderUsefulSqm: number | null;
  partnershipCostWithTaxPerBuilderUsefulSqm: number | null;
  partnershipPureCostPerBuilderUsefulSqm: number | null;
}

export interface ProjectValuation {
  items: VersionItemSnapshot[];
  totalBaseAmount: number;
  totalReferenceAmount: number;
  totalEstimatedAmount: number;
  taxPercent: number;
  baseTaxAmount: number;
  totalBaseWithTax: number;
  estimatedTaxAmount: number;
  totalEstimatedWithTax: number;
  diffFromBaseAmount: number;
  diffFromBasePercent: number;
  basePerSqm: number | null;
  estimatedPerSqm: number | null;
  basePerUsefulSqm: number | null;
  estimatedPerUsefulSqm: number | null;
  partnership: PartnershipValuationMetrics;
  categoryBreakdown: CategoryBreakdownItem[];
}

export interface AiCostAnalysis {
  summary: string;
  keyDrivers: string[];
  riskWarnings: string[];
  recommendations: string[];
}

export type AppSection =
  | 'dashboard'
  | 'detailed'
  | 'expenses'
  | 'versions'
  | 'categories'
  | 'projects';
