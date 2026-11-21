import { connectToDatabase, DatabaseConfigError } from '../lib/mongodb';
import { hashPassword, verifyPassword } from '../lib/password';
import { BuilderModel, type BuilderDoc } from '../models/Builder';
import { CategoryModel } from '../models/Category';
import { getNextSequence } from '../models/Counter';
import { ExpenseModel } from '../models/Expense';
import { PricingVersionModel } from '../models/PricingVersion';
import { ProjectModel } from '../models/Project';

export interface PublicBuilderSummary {
  id: number;
  displayName: string;
  username: string;
  isActive: boolean;
  projectCount: number;
  createdAt: string;
}

function serializeBuilder(
  doc: Omit<BuilderDoc, 'passwordHash'>,
  projectCount = 0
): PublicBuilderSummary {
  return {
    id: doc.id,
    displayName: doc.displayName,
    username: doc.username,
    isActive: doc.isActive !== false,
    projectCount,
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export function normalizeUsername(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

export async function listBuildersWithProjectCounts(): Promise<
  PublicBuilderSummary[]
> {
  await connectToDatabase();

  const [builders, projectCounts] = await Promise.all([
    BuilderModel.find({}, { passwordHash: 0 }).sort({ id: -1 }).lean(),
    ProjectModel.aggregate<{ _id: number; count: number }>([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = new Map(projectCounts.map((c) => [c._id, c.count]));
  return builders.map((b) => serializeBuilder(b, countMap.get(b.id) ?? 0));
}

export async function createBuilderAccount(input: {
  displayName: string;
  username: string;
  password: string;
}): Promise<PublicBuilderSummary> {
  await connectToDatabase();

  const cleanName = input.displayName.trim();
  const cleanUsername = normalizeUsername(input.username);

  const existing = await BuilderModel.findOne(
    { username: cleanUsername },
    { id: 1 }
  ).lean();
  if (existing) {
    throw new Error('این نام کاربری قبلاً برای سازندهٔ دیگری ثبت شده است.');
  }

  const id = await getNextSequence('builders');
  const passwordHash = await hashPassword(input.password);

  try {
    const created = await BuilderModel.create({
      id,
      displayName: cleanName,
      username: cleanUsername,
      passwordHash,
      isActive: true,
    });
    return serializeBuilder(created.toObject(), 0);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: number }).code === 11000
    ) {
      throw new Error('این نام کاربری قبلاً ثبت شده است.');
    }
    throw err;
  }
}

export async function updateBuilderAccount(
  builderId: number,
  updates: {
    displayName?: string;
    password?: string;
    isActive?: boolean;
  }
): Promise<PublicBuilderSummary | null> {
  await connectToDatabase();

  const setFields: Record<string, unknown> = {};
  if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
    setFields.displayName = updates.displayName.trim();
  }
  if (typeof updates.isActive === 'boolean') {
    setFields.isActive = updates.isActive;
  }
  if (typeof updates.password === 'string' && updates.password.length > 0) {
    setFields.passwordHash = await hashPassword(updates.password);
  }

  const updated = await BuilderModel.findOneAndUpdate(
    { id: builderId },
    { $set: setFields },
    { returnDocument: 'after', projection: { passwordHash: 0 } }
  ).lean();

  if (!updated) return null;

  const count = await ProjectModel.countDocuments({ userId: builderId });
  return serializeBuilder(updated, count);
}

export async function deleteBuilderAccount(
  builderId: number
): Promise<boolean> {
  await connectToDatabase();

  const existing = await BuilderModel.findOne({ id: builderId }).lean();
  if (!existing) return false;

  const projects = await ProjectModel.find(
    { userId: builderId },
    { id: 1 }
  ).lean();
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length > 0) {
    await Promise.all([
      CategoryModel.deleteMany({ projectId: { $in: projectIds } }),
      ExpenseModel.deleteMany({ projectId: { $in: projectIds } }),
      PricingVersionModel.deleteMany({ projectId: { $in: projectIds } }),
      ProjectModel.deleteMany({ userId: builderId }),
    ]);
  }

  const res = await BuilderModel.deleteOne({ id: builderId });
  return res.deletedCount > 0;
}

export async function authenticateBuilder(
  rawUsername: string,
  password: string
): Promise<{
  builder: PublicBuilderSummary | null;
  reason: 'invalid' | 'disabled' | null;
}> {
  try {
    await connectToDatabase();
  } catch (err) {
    if (err instanceof DatabaseConfigError) throw err;
    throw new Error('خطا در اتصال به پایگاه داده.', { cause: err });
  }

  const username = normalizeUsername(rawUsername);
  const builder = await BuilderModel.findOne({ username }).lean();
  if (!builder) {
    return { builder: null, reason: 'invalid' };
  }

  const matches = await verifyPassword(password, builder.passwordHash);
  if (!matches) {
    return { builder: null, reason: 'invalid' };
  }

  if (builder.isActive === false) {
    return { builder: null, reason: 'disabled' };
  }

  return {
    builder: serializeBuilder(builder, 0),
    reason: null,
  };
}

export async function getActiveBuilderById(
  builderId: number
): Promise<PublicBuilderSummary | null> {
  await connectToDatabase();
  const builder = await BuilderModel.findOne(
    { id: builderId, isActive: true },
    { passwordHash: 0 }
  ).lean();
  return builder ? serializeBuilder(builder, 0) : null;
}
