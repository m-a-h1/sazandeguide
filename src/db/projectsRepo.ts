import { DEFAULT_CATEGORIES_TEMPLATE, PDF_SAMPLE_AUDIT_NOTE, PDF_SAMPLE_EXPENSES } from "../data/pdfSeed";
import { connectToDatabase, DatabaseConfigError } from "../lib/mongodb";
import { deleteProjectImageFromS3 } from "../lib/projectImages";
import { CategoryModel, type CategoryDoc } from "../models/Category";
import { getNextSequence, getNextSequenceRange } from "../models/Counter";
import { ExpenseModel, type ExpenseDoc } from "../models/Expense";
import { ExpenseTagModel, type ExpenseTagDoc } from "../models/ExpenseTag";
import { PricingVersionModel, type PricingVersionDoc } from "../models/PricingVersion";
import { ProjectModel, type ProjectDoc } from "../models/Project";
import type {
  ExpenseEntryMode,
  ExpenseImageAttachment,
  ExpenseUnitType,
  VersionItemSnapshot,
  WeightUnit,
} from "../types/app";

export class TagConflictError extends Error {
  constructor(message = "برچسبی با این نام از قبل در این پروژه وجود دارد.") {
    super(message);
    this.name = "TagConflictError";
  }
}

function sanitizeDbError(context: string, error: unknown): Error {
  if (error instanceof DatabaseConfigError || error instanceof TagConflictError) {
    return error;
  }
  console.error(`Database error in ${context}:`, error);
  return new Error("خطا در ارتباط با پایگاه داده. لطفاً دوباره تلاش کنید.", {
    cause: error,
  });
}

export function sanitizeRateRecord(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const clean: Record<string, number> = {};
  for (const [key, val] of Object.entries(input)) {
    if (!key || key.startsWith("$") || key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    if (typeof val === "number" && Number.isFinite(val)) {
      clean[key] = val;
    }
  }
  return clean;
}

function serializeProject(doc: ProjectDoc) {
  return {
    id: doc.id,
    userId: doc.userId,
    name: doc.name,
    address: doc.address ?? "",
    description: doc.description ?? "",
    areaSqm: typeof doc.areaSqm === "number" ? doc.areaSqm : null,
    usefulAreaSqm: typeof doc.usefulAreaSqm === "number" ? doc.usefulAreaSqm : null,
    floors: typeof doc.floors === "number" ? doc.floors : null,
    units: typeof doc.units === "number" ? doc.units : null,
    startDateJalali: doc.startDateJalali ?? "",
    endDateJalali: doc.endDateJalali ?? "",
    status: doc.status ?? "در حال ساخت",
    currency: doc.currency ?? "تعیین‌نشده",
    taxPercent: typeof doc.taxPercent === "number" ? doc.taxPercent : 0,
    landPrice: typeof doc.landPrice === "number" ? doc.landPrice : 0,
    partnershipPercent: typeof doc.partnershipPercent === "number" ? doc.partnershipPercent : null,
    pdfAuditNote: doc.pdfAuditNote ?? "",
    draftCategoryRates: sanitizeRateRecord(doc.draftCategoryRates),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

function serializeCategory(doc: CategoryDoc) {
  return {
    id: doc.id,
    projectId: doc.projectId,
    name: doc.name,
    sortOrder: typeof doc.sortOrder === "number" ? doc.sortOrder : 0,
    subcategories: Array.isArray(doc.subcategories) ? doc.subcategories : [],
  };
}

function serializeTag(doc: ExpenseTagDoc) {
  return {
    id: doc.id,
    projectId: doc.projectId,
    name: doc.name,
    percentAdjustment:
      typeof doc.percentAdjustment === "number" ? doc.percentAdjustment : 0,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

function serializeExpense(doc: ExpenseDoc) {
  const entryMode: ExpenseEntryMode =
    doc.entryMode === "detailed" || Boolean(doc.unitType)
      ? "detailed"
      : "general";
  const unitType: ExpenseUnitType | null =
    doc.unitType === "weight" ||
    doc.unitType === "count" ||
    doc.unitType === "meter" ||
    doc.unitType === "service"
      ? doc.unitType
      : null;
  const weightUnit: WeightUnit | null =
    doc.weightUnit === "kg" || doc.weightUnit === "ton" ? doc.weightUnit : null;
  const images: ExpenseImageAttachment[] = Array.isArray(doc.images)
    ? doc.images.map((img) => ({
        key: img.key,
        url: img.url,
        fileName: img.fileName ?? "image",
        contentType: img.contentType ?? "image/jpeg",
        size: typeof img.size === "number" ? img.size : 0,
        uploadedAt: img.uploadedAt ?? "",
      }))
    : [];

  return {
    id: doc.id,
    projectId: doc.projectId,
    categoryId: typeof doc.categoryId === "number" ? doc.categoryId : null,
    categoryName: doc.categoryName,
    subcategory: doc.subcategory ?? "",
    tagId: typeof doc.tagId === "number" ? doc.tagId : null,
    tagName: doc.tagName ?? "",
    dateJalali: doc.dateJalali,
    title: doc.title,
    baseAmount: doc.baseAmount,
    overridePercent: typeof doc.overridePercent === "number" ? doc.overridePercent : null,
    source: doc.source ?? "دستی",
    entryMode,
    unitType,
    quantity: typeof doc.quantity === "number" ? doc.quantity : null,
    itemCount: typeof doc.itemCount === "number" ? doc.itemCount : null,
    weightUnit,
    unitPrice: typeof doc.unitPrice === "number" ? doc.unitPrice : null,
    description: doc.description ?? "",
    images,
  };
}

function serializeVersion(doc: PricingVersionDoc) {
  return {
    id: doc.id,
    projectId: doc.projectId,
    name: doc.name,
    versionDateJalali: doc.versionDateJalali,
    description: doc.description ?? "",
    baseReferenceType: doc.baseReferenceType === "VERSION" ? "VERSION" : "BASE",
    parentVersionId: typeof doc.parentVersionId === "number" ? doc.parentVersionId : null,
    parentVersionName: doc.parentVersionName ?? null,
    categoryRatesSnapshot: sanitizeRateRecord(doc.categoryRatesSnapshot),
    taxPercentSnapshot: typeof doc.taxPercentSnapshot === "number" ? doc.taxPercentSnapshot : 0,
    landPriceSnapshot: typeof doc.landPriceSnapshot === "number" ? doc.landPriceSnapshot : 0,
    partnershipPercentSnapshot: typeof doc.partnershipPercentSnapshot === "number" ? doc.partnershipPercentSnapshot : null,
    totalBaseAmount: doc.totalBaseAmount,
    totalReferenceAmount: doc.totalReferenceAmount,
    totalEstimatedAmount: doc.totalEstimatedAmount,
    diffFromBaseAmount: doc.diffFromBaseAmount,
    diffFromBasePercent: doc.diffFromBasePercent,
    itemsSnapshot: Array.isArray(doc.itemsSnapshot) ? doc.itemsSnapshot : [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
  };
}

async function assertProjectOwnership(projectId: number, userId: number) {
  if (!Number.isInteger(projectId) || projectId <= 0) return null;
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return ProjectModel.findOne({ id: projectId, userId }).lean();
}

export async function assertBuilderOwnsProject(
  userId: number,
  projectId: number,
): Promise<boolean> {
  try {
    await connectToDatabase();
    const owned = await assertProjectOwnership(projectId, userId);
    return Boolean(owned);
  } catch (error) {
    throw sanitizeDbError("assertBuilderOwnsProject", error);
  }
}

export async function getOwnedProjectName(userId: number, projectId: number): Promise<string | null> {
  try {
    await connectToDatabase();
    const project = await assertProjectOwnership(projectId, userId);
    return project?.name ?? null;
  } catch (error) {
    throw sanitizeDbError("getOwnedProjectName", error);
  }
}

export async function getOrSeedUserWorkspace(userId: number) {
  try {
    await connectToDatabase();

    let userProjects = await ProjectModel.find({ userId }).sort({ id: 1 }).lean();

    if (userProjects.length === 0) {
      const projectId = await getNextSequence("projects");
      await ProjectModel.create({
        id: projectId,
        userId,
        name: "پروژه ی تستی",
        address: "بلوار فردوسی (دادهٔ نمونه از گزارش پی‌دی‌اف)",
        description: "",
        areaSqm: null,
        usefulAreaSqm: null,
        floors: null,
        units: null,
        startDateJalali: "1405/07/27",
        endDateJalali: "",
        status: "در حال ساخت",
        currency: "تعیین‌نشده",
        taxPercent: 0,
        landPrice: 0,
        partnershipPercent: null,
        pdfAuditNote: PDF_SAMPLE_AUDIT_NOTE,
        draftCategoryRates: {},
      });

      const catStartId = await getNextSequenceRange("categories", DEFAULT_CATEGORIES_TEMPLATE.length);
      const insertedCategories = await CategoryModel.insertMany(
        DEFAULT_CATEGORIES_TEMPLATE.map((c, idx) => ({
          id: catStartId + idx,
          projectId,
          name: c.name,
          sortOrder: c.sortOrder,
          subcategories: [...c.subcategories],
        })),
      );

      const catIdMap = new Map(insertedCategories.map((c) => [c.name, c.id]));

      const expStartId = await getNextSequenceRange("expenses", PDF_SAMPLE_EXPENSES.length);
      await ExpenseModel.insertMany(
        PDF_SAMPLE_EXPENSES.map((item, idx) => ({
          id: expStartId + idx,
          projectId,
          categoryId: catIdMap.get(item.categoryName) ?? null,
          categoryName: item.categoryName,
          subcategory: item.subcategory,
          dateJalali: item.dateJalali,
          title: item.title,
          baseAmount: item.baseAmount,
          overridePercent: null,
          source: "نمونه",
        })),
      );

      userProjects = await ProjectModel.find({ userId }).sort({ id: 1 }).lean();
    }

    const projectIds = userProjects.map((p) => p.id);
    if (projectIds.length === 0) {
      return { projects: [], categories: [], expenses: [], versions: [], tags: [] };
    }

    const [allCategories, allExpenses, allVersions, allTags] = await Promise.all([
      CategoryModel.find({ projectId: { $in: projectIds } })
        .sort({ sortOrder: 1, id: 1 })
        .lean(),
      ExpenseModel.find({ projectId: { $in: projectIds } })
        .sort({ id: 1 })
        .lean(),
      PricingVersionModel.find({ projectId: { $in: projectIds } })
        .sort({ id: -1 })
        .lean(),
      ExpenseTagModel.find({ projectId: { $in: projectIds } })
        .sort({ id: 1 })
        .lean(),
    ]);

    return {
      projects: userProjects.map(serializeProject),
      categories: allCategories.map(serializeCategory),
      expenses: allExpenses.map(serializeExpense),
      versions: allVersions.map(serializeVersion),
      tags: allTags.map(serializeTag),
    };
  } catch (error) {
    throw sanitizeDbError("getOrSeedUserWorkspace", error);
  }
}

export async function createProjectForUser(
  userId: number,
  data: {
    name: string;
    address?: string;
    description?: string;
    areaSqm?: number | null;
    usefulAreaSqm?: number | null;
    floors?: number | null;
    units?: number | null;
    startDateJalali?: string;
    endDateJalali?: string;
    status?: string;
    currency?: string;
    taxPercent?: number;
    landPrice?: number;
    partnershipPercent?: number | null;
  },
) {
  try {
    await connectToDatabase();

    const projectId = await getNextSequence("projects");
    const createdDoc = await ProjectModel.create({
      id: projectId,
      userId,
      name: data.name,
      address: data.address ?? "",
      description: data.description ?? "",
      areaSqm: data.areaSqm ?? null,
      usefulAreaSqm: data.usefulAreaSqm ?? null,
      floors: data.floors ?? null,
      units: data.units ?? null,
      startDateJalali: data.startDateJalali ?? "",
      endDateJalali: data.endDateJalali ?? "",
      status: data.status ?? "در حال ساخت",
      currency: data.currency ?? "تومان",
      taxPercent: data.taxPercent ?? 0,
      landPrice: data.landPrice ?? 0,
      partnershipPercent: data.partnershipPercent ?? null,
      pdfAuditNote: "",
      draftCategoryRates: {},
    });

    const catStartId = await getNextSequenceRange("categories", DEFAULT_CATEGORIES_TEMPLATE.length);
    const insertedCats = await CategoryModel.insertMany(
      DEFAULT_CATEGORIES_TEMPLATE.map((c, idx) => ({
        id: catStartId + idx,
        projectId,
        name: c.name,
        sortOrder: c.sortOrder,
        subcategories: [...c.subcategories],
      })),
    );

    return {
      project: serializeProject(createdDoc.toObject()),
      categories: insertedCats.map((c) => serializeCategory(c.toObject())),
    };
  } catch (error) {
    throw sanitizeDbError("createProjectForUser", error);
  }
}

export async function updateProjectForUser(
  userId: number,
  projectId: number,
  data: Partial<{
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
    draftCategoryRates: Record<string, number>;
  }>,
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const cleanData: Record<string, unknown> = { ...data };
    if (data.draftCategoryRates !== undefined) {
      cleanData.draftCategoryRates = sanitizeRateRecord(data.draftCategoryRates);
    }

    const updated = await ProjectModel.findOneAndUpdate({ id: projectId, userId }, { $set: cleanData }, { returnDocument: "after" }).lean();

    return updated ? serializeProject(updated) : null;
  } catch (error) {
    throw sanitizeDbError("updateProjectForUser", error);
  }
}

export async function deleteProjectForUser(userId: number, projectId: number) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    const projectExpenses = await ExpenseModel.find({ projectId })
      .select({ images: 1 })
      .lean();
    const imageKeys = projectExpenses.flatMap((exp) =>
      Array.isArray(exp.images) ? exp.images.map((i) => i.key) : [],
    );

    await Promise.all([
      CategoryModel.deleteMany({ projectId }),
      ExpenseModel.deleteMany({ projectId }),
      ExpenseTagModel.deleteMany({ projectId }),
      PricingVersionModel.deleteMany({ projectId }),
      ProjectModel.deleteOne({ id: projectId, userId }),
    ]);

    if (imageKeys.length > 0) {
      await Promise.allSettled(
        imageKeys.map((key) => deleteProjectImageFromS3(projectId, key)),
      );
    }

    return true;
  } catch (error) {
    throw sanitizeDbError("deleteProjectForUser", error);
  }
}

export async function createCategoryForProject(
  userId: number,
  projectId: number,
  data: { name: string; subcategories?: string[]; sortOrder?: number },
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const existing = await CategoryModel.find({ projectId }).lean();
    const maxOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    const id = await getNextSequence("categories");

    const created = await CategoryModel.create({
      id,
      projectId,
      name: data.name,
      sortOrder: data.sortOrder ?? maxOrder + 1,
      subcategories: data.subcategories ?? [],
    });

    return serializeCategory(created.toObject());
  } catch (error) {
    throw sanitizeDbError("createCategoryForProject", error);
  }
}

export async function updateCategoryForProject(
  userId: number,
  projectId: number,
  categoryId: number,
  data: Partial<{ name: string; subcategories: string[]; sortOrder: number }>,
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const oldCat = await CategoryModel.findOne({
      id: categoryId,
      projectId,
    }).lean();
    if (!oldCat) return null;

    const updated = await CategoryModel.findOneAndUpdate({ id: categoryId, projectId }, { $set: data }, { returnDocument: "after" }).lean();

    if (!updated) return null;

    if (data.name && data.name !== oldCat.name) {
      await ExpenseModel.updateMany({ projectId, categoryId }, { $set: { categoryName: data.name } });

      const rates = sanitizeRateRecord(owned.draftCategoryRates);
      if (Object.prototype.hasOwnProperty.call(rates, oldCat.name)) {
        rates[data.name] = rates[oldCat.name];
        delete rates[oldCat.name];
        await ProjectModel.updateOne({ id: projectId, userId }, { $set: { draftCategoryRates: rates } });
      }
    }

    return serializeCategory(updated);
  } catch (error) {
    throw sanitizeDbError("updateCategoryForProject", error);
  }
}

export async function reorderCategoriesForProject(userId: number, projectId: number, orderedIds: number[]) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    if (orderedIds.length > 0) {
      await CategoryModel.bulkWrite(
        orderedIds.map((catId, idx) => ({
          updateOne: {
            filter: { id: catId, projectId },
            update: { $set: { sortOrder: idx + 1 } },
          },
        })),
      );
    }

    return true;
  } catch (error) {
    throw sanitizeDbError("reorderCategoriesForProject", error);
  }
}

export async function deleteCategoryForProject(userId: number, projectId: number, categoryId: number, targetCategoryId: number | null) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    if (targetCategoryId) {
      const targetCat = await CategoryModel.findOne({
        id: targetCategoryId,
        projectId,
      }).lean();
      if (targetCat) {
        await ExpenseModel.updateMany(
          { projectId, categoryId },
          {
            $set: {
              categoryId: targetCat.id,
              categoryName: targetCat.name,
            },
          },
        );
      }
    } else {
      await ExpenseModel.updateMany({ projectId, categoryId }, { $set: { categoryId: null } });
    }

    await CategoryModel.deleteOne({ id: categoryId, projectId });
    return true;
  } catch (error) {
    throw sanitizeDbError("deleteCategoryForProject", error);
  }
}

export async function createExpensesForProject(
  userId: number,
  projectId: number,
  items: Array<{
    categoryName: string;
    subcategory: string;
    tagId?: number | null;
    dateJalali: string;
    title: string;
    baseAmount: number;
    overridePercent?: number | null;
    source: string;
    entryMode?: ExpenseEntryMode;
    unitType?: ExpenseUnitType | null;
    quantity?: number | null;
    itemCount?: number | null;
    weightUnit?: WeightUnit | null;
    unitPrice?: number | null;
    description?: string;
    images?: ExpenseImageAttachment[];
  }>,
  mode: "append" | "replace" = "append",
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    if (mode === "replace") {
      await ExpenseModel.deleteMany({ projectId });
    }

    const [existingCats, existingTags] = await Promise.all([
      CategoryModel.find({ projectId }).lean(),
      ExpenseTagModel.find({ projectId }).lean(),
    ]);
    const catByName = new Map<string, CategoryDoc>(existingCats.map((c) => [c.name, c]));
    const tagById = new Map<number, ExpenseTagDoc>(existingTags.map((t) => [t.id, t]));
    let maxOrder = existingCats.reduce((m, c) => Math.max(m, c.sortOrder), 0);

    for (const item of items) {
      let cat = catByName.get(item.categoryName);
      if (!cat) {
        maxOrder += 1;
        const catId = await getNextSequence("categories");
        const created = await CategoryModel.create({
          id: catId,
          projectId,
          name: item.categoryName,
          sortOrder: maxOrder,
          subcategories: item.subcategory ? [item.subcategory] : [],
        });
        cat = created.toObject();
        catByName.set(cat.name, cat);
      } else if (item.subcategory && !cat.subcategories.includes(item.subcategory)) {
        const updatedSubs = [...cat.subcategories, item.subcategory];
        const updatedCat = await CategoryModel.findOneAndUpdate(
          { id: cat.id, projectId },
          { $set: { subcategories: updatedSubs } },
          { returnDocument: "after" },
        ).lean();
        if (updatedCat) {
          cat = updatedCat;
          catByName.set(cat.name, cat);
        }
      }
    }

    const expStartId = await getNextSequenceRange("expenses", items.length);
    const inserted = await ExpenseModel.insertMany(
      items.map((item, idx) => {
        const resolvedTag =
          typeof item.tagId === "number" ? tagById.get(item.tagId) ?? null : null;
        return {
          id: expStartId + idx,
          projectId,
          categoryId: catByName.get(item.categoryName)?.id ?? null,
          categoryName: item.categoryName,
          subcategory: item.subcategory ?? "",
          tagId: resolvedTag ? resolvedTag.id : null,
          tagName: resolvedTag ? resolvedTag.name : "",
          dateJalali: item.dateJalali,
          title: item.title,
          baseAmount: item.baseAmount,
          overridePercent: item.overridePercent ?? null,
          source: item.source,
          entryMode: item.entryMode ?? "general",
          unitType: item.unitType ?? null,
          quantity: item.quantity ?? null,
          itemCount: item.itemCount ?? null,
          weightUnit: item.weightUnit ?? null,
          unitPrice: item.unitPrice ?? null,
          description: item.description ?? "",
          images: Array.isArray(item.images) ? item.images : [],
        };
      }),
    );

    const updatedCats = await CategoryModel.find({ projectId }).sort({ sortOrder: 1, id: 1 }).lean();

    return {
      inserted: inserted.map((e) => serializeExpense(e.toObject())),
      categories: updatedCats.map(serializeCategory),
    };
  } catch (error) {
    throw sanitizeDbError("createExpensesForProject", error);
  }
}

export async function updateExpenseForProject(
  userId: number,
  projectId: number,
  expenseId: number,
  data: Partial<{
    categoryId: number | null;
    categoryName: string;
    subcategory: string;
    tagId: number | null;
    dateJalali: string;
    title: string;
    baseAmount: number;
    overridePercent: number | null;
    entryMode: ExpenseEntryMode;
    unitType: ExpenseUnitType | null;
    quantity: number | null;
    itemCount: number | null;
    weightUnit: WeightUnit | null;
    unitPrice: number | null;
    description: string;
    images: ExpenseImageAttachment[];
  }>,
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const existing = await ExpenseModel.findOne({ id: expenseId, projectId }).lean();
    if (!existing) return null;

    if (data.categoryName && data.subcategory) {
      const cat = await CategoryModel.findOne({
        projectId,
        name: data.categoryName,
      }).lean();
      if (cat && !cat.subcategories.includes(data.subcategory)) {
        await CategoryModel.updateOne(
          { id: cat.id, projectId },
          { $set: { subcategories: [...cat.subcategories, data.subcategory] } },
        );
      }
    }

    const cleanUpdates: Record<string, unknown> = { ...data };
    if (data.tagId !== undefined) {
      if (data.tagId === null) {
        cleanUpdates.tagId = null;
        cleanUpdates.tagName = "";
      } else if (typeof data.tagId === "number") {
        const tagDoc = await ExpenseTagModel.findOne({
          id: data.tagId,
          projectId,
        }).lean();
        if (tagDoc) {
          cleanUpdates.tagId = tagDoc.id;
          cleanUpdates.tagName = tagDoc.name;
        } else {
          cleanUpdates.tagId = null;
          cleanUpdates.tagName = "";
        }
      }
    }

    const updated = await ExpenseModel.findOneAndUpdate(
      { id: expenseId, projectId },
      { $set: cleanUpdates },
      { returnDocument: "after" },
    ).lean();

    if (updated && Array.isArray(data.images) && Array.isArray(existing.images)) {
      const nextKeys = new Set(data.images.map((i) => i.key));
      const removedKeys = existing.images
        .map((i) => i.key)
        .filter((key) => !nextKeys.has(key));
      if (removedKeys.length > 0) {
        await Promise.allSettled(
          removedKeys.map((key) => deleteProjectImageFromS3(projectId, key)),
        );
      }
    }

    return updated ? serializeExpense(updated) : null;
  } catch (error) {
    throw sanitizeDbError("updateExpenseForProject", error);
  }
}

export async function bulkSetSubcategoryOverrideForProject(
  userId: number,
  projectId: number,
  categoryName: string,
  subcategory: string,
  overridePercent: number | null,
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    await ExpenseModel.updateMany({ projectId, categoryName, subcategory }, { $set: { overridePercent } });

    const updated = await ExpenseModel.find({
      projectId,
      categoryName,
      subcategory,
    })
      .sort({ id: 1 })
      .lean();

    return updated.map(serializeExpense);
  } catch (error) {
    throw sanitizeDbError("bulkSetSubcategoryOverrideForProject", error);
  }
}

export async function deleteExpenseForProject(userId: number, projectId: number, expenseId: number) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    const existing = await ExpenseModel.findOne({ id: expenseId, projectId }).lean();
    if (!existing) return false;

    const res = await ExpenseModel.deleteOne({ id: expenseId, projectId });
    if (res.deletedCount > 0 && Array.isArray(existing.images) && existing.images.length > 0) {
      await Promise.allSettled(
        existing.images.map((img) => deleteProjectImageFromS3(projectId, img.key)),
      );
    }
    return res.deletedCount > 0;
  } catch (error) {
    throw sanitizeDbError("deleteExpenseForProject", error);
  }
}

export async function createPricingVersionForProject(
  userId: number,
  projectId: number,
  payload: {
    name: string;
    versionDateJalali: string;
    description: string;
    baseReferenceType: "BASE" | "VERSION";
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
  },
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const id = await getNextSequence("pricingVersions");
    const created = await PricingVersionModel.create({
      id,
      projectId,
      ...payload,
      categoryRatesSnapshot: sanitizeRateRecord(payload.categoryRatesSnapshot),
    });

    return serializeVersion(created.toObject());
  } catch (error) {
    throw sanitizeDbError("createPricingVersionForProject", error);
  }
}

export async function updatePricingVersionMetaForProject(
  userId: number,
  projectId: number,
  versionId: number,
  data: { name: string; versionDateJalali: string; description: string },
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const updated = await PricingVersionModel.findOneAndUpdate(
      { id: versionId, projectId },
      {
        $set: {
          name: data.name,
          versionDateJalali: data.versionDateJalali,
          description: data.description,
        },
      },
      { returnDocument: "after" },
    ).lean();

    return updated ? serializeVersion(updated) : null;
  } catch (error) {
    throw sanitizeDbError("updatePricingVersionMetaForProject", error);
  }
}

export async function deletePricingVersionForProject(userId: number, projectId: number, versionId: number) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    const res = await PricingVersionModel.deleteOne({
      id: versionId,
      projectId,
    });
    return res.deletedCount > 0;
  } catch (error) {
    throw sanitizeDbError("deletePricingVersionForProject", error);
  }
}

export async function listTagsForProject(userId: number, projectId: number) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const docs = await ExpenseTagModel.find({ projectId }).sort({ id: 1 }).lean();
    return docs.map(serializeTag);
  } catch (error) {
    throw sanitizeDbError("listTagsForProject", error);
  }
}

export async function createTagForProject(
  userId: number,
  projectId: number,
  data: { name: string; percentAdjustment?: number },
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const existing = await ExpenseTagModel.findOne({
      projectId,
      name: data.name,
    }).lean();
    if (existing) {
      throw new TagConflictError();
    }

    const id = await getNextSequence("tags");
    const created = await ExpenseTagModel.create({
      id,
      projectId,
      name: data.name,
      percentAdjustment:
        typeof data.percentAdjustment === "number" &&
        Number.isFinite(data.percentAdjustment)
          ? data.percentAdjustment
          : 0,
    });

    return serializeTag(created.toObject());
  } catch (error) {
    throw sanitizeDbError("createTagForProject", error);
  }
}

export async function updateTagForProject(
  userId: number,
  projectId: number,
  tagId: number,
  data: Partial<{ name: string; percentAdjustment: number }>,
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const existing = await ExpenseTagModel.findOne({ id: tagId, projectId }).lean();
    if (!existing) return null;

    const cleanUpdates: Record<string, unknown> = {};
    if (data.name !== undefined) {
      if (data.name !== existing.name) {
        const dup = await ExpenseTagModel.findOne({
          projectId,
          name: data.name,
          id: { $ne: tagId },
        }).lean();
        if (dup) {
          throw new TagConflictError();
        }
      }
      cleanUpdates.name = data.name;
    }

    if (
      data.percentAdjustment !== undefined &&
      typeof data.percentAdjustment === "number" &&
      Number.isFinite(data.percentAdjustment)
    ) {
      cleanUpdates.percentAdjustment = data.percentAdjustment;
    }

    const updated = await ExpenseTagModel.findOneAndUpdate(
      { id: tagId, projectId },
      { $set: cleanUpdates },
      { returnDocument: "after" },
    ).lean();

    if (!updated) return null;

    if (data.name && data.name !== existing.name) {
      await ExpenseModel.updateMany(
        { projectId, tagId },
        { $set: { tagName: data.name } },
      );
    }

    return serializeTag(updated);
  } catch (error) {
    throw sanitizeDbError("updateTagForProject", error);
  }
}

export async function deleteTagForProject(
  userId: number,
  projectId: number,
  tagId: number,
) {
  try {
    await connectToDatabase();

    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    const res = await ExpenseTagModel.deleteOne({ id: tagId, projectId });
    if (res.deletedCount > 0) {
      await ExpenseModel.updateMany(
        { projectId, tagId },
        { $set: { tagId: null, tagName: "" } },
      );
      return true;
    }
    return false;
  } catch (error) {
    throw sanitizeDbError("deleteTagForProject", error);
  }
}
