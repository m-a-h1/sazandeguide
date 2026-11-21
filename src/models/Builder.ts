import mongoose, { Schema, type Model } from 'mongoose';

export interface BuilderDoc {
  id: number;
  displayName: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BuilderSchema = new Schema<BuilderDoc>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const BuilderModel: Model<BuilderDoc> =
  (mongoose.models.Builder as Model<BuilderDoc>) ||
  mongoose.model<BuilderDoc>('Builder', BuilderSchema);
