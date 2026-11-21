import mongoose, { Schema, type Model } from 'mongoose';
import type { VersionItemSnapshot } from '../types/app';

export interface PricingVersionDoc {
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
  createdAt: Date;
}

const VersionItemSnapshotSchema = new Schema<VersionItemSnapshot>(
  {
    expenseId: { type: Number, required: true },
    title: { type: String, required: true },
    categoryName: { type: String, required: true },
    subcategory: { type: String, default: '' },
    dateJalali: { type: String, required: true },
    baseAmount: { type: Number, required: true },
    referenceAmount: { type: Number, required: true },
    categoryRateApplied: { type: Number, required: true },
    overridePercent: { type: Number, default: null },
    effectivePercent: { type: Number, required: true },
    rateSource: {
      type: String,
      enum: ['CATEGORY', 'INDEPENDENT'],
      required: true,
    },
    estimatedAmount: { type: Number, required: true },
    diffFromBaseAmount: { type: Number, required: true },
    diffFromBasePercent: { type: Number, required: true },
  },
  { _id: false }
);

const PricingVersionSchema = new Schema<PricingVersionDoc>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    projectId: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    versionDateJalali: { type: String, required: true },
    description: { type: String, default: '' },
    baseReferenceType: {
      type: String,
      enum: ['BASE', 'VERSION'],
      default: 'BASE',
    },
    parentVersionId: { type: Number, default: null },
    parentVersionName: { type: String, default: null },
    categoryRatesSnapshot: { type: Schema.Types.Mixed, default: () => ({}) },
    taxPercentSnapshot: { type: Number, default: 0 },
    landPriceSnapshot: { type: Number, default: 0 },
    partnershipPercentSnapshot: { type: Number, default: null },
    totalBaseAmount: { type: Number, required: true },
    totalReferenceAmount: { type: Number, required: true },
    totalEstimatedAmount: { type: Number, required: true },
    diffFromBaseAmount: { type: Number, required: true },
    diffFromBasePercent: { type: Number, required: true },
    itemsSnapshot: { type: [VersionItemSnapshotSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, minimize: false }
);

PricingVersionSchema.index({ projectId: 1, id: -1 });

export const PricingVersionModel: Model<PricingVersionDoc> =
  (mongoose.models.PricingVersion as Model<PricingVersionDoc>) ||
  mongoose.model<PricingVersionDoc>('PricingVersion', PricingVersionSchema);
