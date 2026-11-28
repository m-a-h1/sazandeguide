import mongoose, { Schema, type Model } from 'mongoose';

export interface ExpenseTagDoc {
  id: number;
  projectId: number;
  name: string;
  percentAdjustment: number;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseTagSchema = new Schema<ExpenseTagDoc>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    projectId: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    percentAdjustment: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

ExpenseTagSchema.index({ projectId: 1, id: 1 });
ExpenseTagSchema.index({ projectId: 1, name: 1 }, { unique: true });

export const ExpenseTagModel: Model<ExpenseTagDoc> =
  (mongoose.models.ExpenseTag as Model<ExpenseTagDoc>) ||
  mongoose.model<ExpenseTagDoc>('ExpenseTag', ExpenseTagSchema);
