import mongoose, { Schema, type Model } from 'mongoose';

export interface ExpenseImageSubdoc {
  key: string;
  url: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface ExpenseDoc {
  id: number;
  projectId: number;
  categoryId: number | null;
  categoryName: string;
  subcategory: string;
  dateJalali: string;
  title: string;
  baseAmount: number;
  overridePercent: number | null;
  source: string;
  entryMode?: 'general' | 'detailed';
  unitType?: 'weight' | 'count' | 'meter' | 'service' | null;
  quantity?: number | null;
  itemCount?: number | null;
  weightUnit?: 'kg' | 'ton' | null;
  unitPrice?: number | null;
  description?: string;
  images?: ExpenseImageSubdoc[];
  tagId?: number | null;
  tagName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseImageSchema = new Schema<ExpenseImageSubdoc>(
  {
    key: { type: String, required: true },
    url: { type: String, required: true },
    fileName: { type: String, default: 'image' },
    contentType: { type: String, default: 'image/jpeg' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: String, default: '' },
  },
  { _id: false }
);

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    projectId: { type: Number, required: true, index: true },
    categoryId: { type: Number, default: null },
    categoryName: { type: String, required: true },
    subcategory: { type: String, default: '' },
    dateJalali: { type: String, required: true },
    title: { type: String, required: true },
    baseAmount: { type: Number, required: true },
    overridePercent: { type: Number, default: null },
    source: { type: String, default: 'دستی' },
    entryMode: { type: String, default: 'general' },
    unitType: { type: String, default: null },
    quantity: { type: Number, default: null },
    itemCount: { type: Number, default: null },
    weightUnit: { type: String, default: null },
    unitPrice: { type: Number, default: null },
    description: { type: String, default: '' },
    images: { type: [ExpenseImageSchema], default: [] },
    tagId: { type: Number, default: null },
    tagName: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

ExpenseSchema.index({ projectId: 1, id: 1 });
ExpenseSchema.index({ projectId: 1, categoryName: 1, subcategory: 1 });
ExpenseSchema.index({ projectId: 1, entryMode: 1 });
ExpenseSchema.index({ projectId: 1, tagId: 1 });

export const ExpenseModel: Model<ExpenseDoc> =
  (mongoose.models.Expense as Model<ExpenseDoc>) ||
  mongoose.model<ExpenseDoc>('Expense', ExpenseSchema);
