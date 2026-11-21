import mongoose, { Schema, type Model } from 'mongoose';

export interface CategoryDoc {
  id: number;
  projectId: number;
  name: string;
  sortOrder: number;
  subcategories: string[];
  createdAt: Date;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    projectId: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    subcategories: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

CategorySchema.index({ projectId: 1, sortOrder: 1, id: 1 });

export const CategoryModel: Model<CategoryDoc> =
  (mongoose.models.Category as Model<CategoryDoc>) ||
  mongoose.model<CategoryDoc>('Category', CategorySchema);
