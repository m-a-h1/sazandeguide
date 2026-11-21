import mongoose, { Schema, type Model } from 'mongoose';

export interface ProjectDoc {
  id: number;
  userId: number;
  name: string;
  address: string;
  description: string;
  areaSqm: number | null;
  usefulAreaSqm: number | null;
  floors: number | null;
  units: number | null;
  startDateJalali: string;
  endDateJalali: string;
  status: string;
  currency: string;
  taxPercent: number;
  landPrice: number;
  partnershipPercent: number | null;
  pdfAuditNote: string;
  draftCategoryRates: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<ProjectDoc>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, default: '' },
    description: { type: String, default: '' },
    areaSqm: { type: Number, default: null },
    usefulAreaSqm: { type: Number, default: null },
    floors: { type: Number, default: null },
    units: { type: Number, default: null },
    startDateJalali: { type: String, default: '' },
    endDateJalali: { type: String, default: '' },
    status: { type: String, default: 'در حال ساخت' },
    currency: { type: String, default: 'تعیین‌نشده' },
    taxPercent: { type: Number, default: 0 },
    landPrice: { type: Number, default: 0 },
    partnershipPercent: { type: Number, default: null },
    pdfAuditNote: { type: String, default: '' },
    draftCategoryRates: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, versionKey: false, minimize: false }
);

ProjectSchema.index({ userId: 1, id: 1 });

export const ProjectModel: Model<ProjectDoc> =
  (mongoose.models.Project as Model<ProjectDoc>) ||
  mongoose.model<ProjectDoc>('Project', ProjectSchema);
