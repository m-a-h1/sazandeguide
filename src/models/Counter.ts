import mongoose, { Schema, type Model } from 'mongoose';

export interface CounterDoc {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

export const CounterModel: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) ||
  mongoose.model<CounterDoc>('Counter', CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const doc = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
  return doc?.seq ?? 1;
}

export async function getNextSequenceRange(
  name: string,
  count: number
): Promise<number> {
  if (count <= 0) return 0;
  const doc = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: count } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
  const end = doc?.seq ?? count;
  return end - count + 1;
}
