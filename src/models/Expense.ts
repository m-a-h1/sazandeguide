import mongoose, { Schema, type Model } from 'mongoose';

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true, versionKey: false }
);

ExpenseSchema.index({ projectId: 1, id: 1 });
ExpenseSchema.index({ projectId: 1, categoryName: 1, subcategory: 1 });

export const ExpenseModel: Model<ExpenseDoc> =
  (mongoose.models.Expense as Model<ExpenseDoc>) ||
  mongoose.model<ExpenseDoc>('Expense', ExpenseSchema);
