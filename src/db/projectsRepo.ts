import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  expenses,
  pricingVersions,
  projects,
  type VersionItemSnapshot,
} from './schema.ts';
import {
  DEFAULT_CATEGORIES_TEMPLATE,
  PDF_SAMPLE_AUDIT_NOTE,
  PDF_SAMPLE_EXPENSES,
} from '../data/pdfSeed.ts';

function sanitizeDbError(context: string, error: unknown): Error {
  console.error(`Database error in ${context}:`, error);
  return new Error('خطا در ارتباط با پایگاه داده. لطفاً دوباره تلاش کنید.', {
    cause: error,
  });
}

async function assertProjectOwnership(projectId: number, userId: number) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrSeedUserWorkspace(userId: number) {
  try {
    let userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.id));

    if (userProjects.length === 0) {
      await db.transaction(async (tx) => {
        const [createdProject] = await tx
          .insert(projects)
          .values({
            userId,
            name: 'گروه مهندسی مفخم ۱۲ - صیاد ۵',
            address: 'بلوار صیاد شیرازی (دادهٔ نمونه از گزارش پی‌دی‌اف)',
            description:
              'پروژهٔ نمونه بارگذاری‌شده از گزارش هزینه‌ها به تاریخ ۱۴۰۵/۰۷/۲۷. مبالغ پایه دقیقاً مطابق سند اولیه حفظ شده‌اند و قابل ویرایش هستند.',
            areaSqm: null,
            usefulAreaSqm: null,
            floors: null,
            units: null,
            startDateJalali: '1405/07/27',
            endDateJalali: '',
            status: 'در حال ساخت',
            currency: 'تعیین‌نشده',
            taxPercent: 0,
            landPrice: 0,
            partnershipPercent: null,
            pdfAuditNote: PDF_SAMPLE_AUDIT_NOTE,
            draftCategoryRates: {},
          })
          .returning();

        const insertedCategories = await tx
          .insert(categories)
          .values(
            DEFAULT_CATEGORIES_TEMPLATE.map((c) => ({
              projectId: createdProject.id,
              name: c.name,
              sortOrder: c.sortOrder,
              subcategories: c.subcategories,
            }))
          )
          .returning();

        const catIdMap = new Map(
          insertedCategories.map((c) => [c.name, c.id])
        );

        await tx.insert(expenses).values(
          PDF_SAMPLE_EXPENSES.map((item) => ({
            projectId: createdProject.id,
            categoryId: catIdMap.get(item.categoryName) ?? null,
            categoryName: item.categoryName,
            subcategory: item.subcategory,
            dateJalali: item.dateJalali,
            title: item.title,
            baseAmount: item.baseAmount,
            overridePercent: null,
            source: 'نمونه',
          }))
        );
      });

      userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(asc(projects.id));
    }

    const projectIds = userProjects.map((p) => p.id);
    if (projectIds.length === 0) {
      return { projects: [], categories: [], expenses: [], versions: [] };
    }

    const [allCategories, allExpenses, allVersions] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(inArray(categories.projectId, projectIds))
        .orderBy(asc(categories.sortOrder), asc(categories.id)),
      db
        .select()
        .from(expenses)
        .where(inArray(expenses.projectId, projectIds))
        .orderBy(asc(expenses.id)),
      db
        .select()
        .from(pricingVersions)
        .where(inArray(pricingVersions.projectId, projectIds))
        .orderBy(desc(pricingVersions.id)),
    ]);

    return {
      projects: userProjects,
      categories: allCategories,
      expenses: allExpenses,
      versions: allVersions,
    };
  } catch (error) {
    throw sanitizeDbError('getOrSeedUserWorkspace', error);
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
  }
) {
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({
          userId,
          name: data.name,
          address: data.address ?? '',
          description: data.description ?? '',
          areaSqm: data.areaSqm ?? null,
          usefulAreaSqm: data.usefulAreaSqm ?? null,
          floors: data.floors ?? null,
          units: data.units ?? null,
          startDateJalali: data.startDateJalali ?? '',
          endDateJalali: data.endDateJalali ?? '',
          status: data.status ?? 'در حال ساخت',
          currency: data.currency ?? 'تومان',
          taxPercent: data.taxPercent ?? 0,
          landPrice: data.landPrice ?? 0,
          partnershipPercent: data.partnershipPercent ?? null,
          pdfAuditNote: '',
          draftCategoryRates: {},
        })
        .returning();

      const insertedCats = await tx
        .insert(categories)
        .values(
          DEFAULT_CATEGORIES_TEMPLATE.map((c) => ({
            projectId: created.id,
            name: c.name,
            sortOrder: c.sortOrder,
            subcategories: c.subcategories,
          }))
        )
        .returning();

      return { project: created, categories: insertedCats };
    });
  } catch (error) {
    throw sanitizeDbError('createProjectForUser', error);
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
  }>
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const [updated] = await db
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();

    return updated ?? null;
  } catch (error) {
    throw sanitizeDbError('updateProjectForUser', error);
  }
}

export async function deleteProjectForUser(userId: number, projectId: number) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;
    await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    return true;
  } catch (error) {
    throw sanitizeDbError('deleteProjectForUser', error);
  }
}

export async function createCategoryForProject(
  userId: number,
  projectId: number,
  data: { name: string; subcategories?: string[]; sortOrder?: number }
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const existing = await db
      .select()
      .from(categories)
      .where(eq(categories.projectId, projectId));
    const maxOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0);

    const [created] = await db
      .insert(categories)
      .values({
        projectId,
        name: data.name,
        sortOrder: data.sortOrder ?? maxOrder + 1,
        subcategories: data.subcategories ?? [],
      })
      .returning();

    return created;
  } catch (error) {
    throw sanitizeDbError('createCategoryForProject', error);
  }
}

export async function updateCategoryForProject(
  userId: number,
  projectId: number,
  categoryId: number,
  data: Partial<{ name: string; subcategories: string[]; sortOrder: number }>
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    return await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.projectId, projectId)
          )
        )
        .limit(1);

      const oldCat = existingRows[0];
      if (!oldCat) return null;

      const [updated] = await tx
        .update(categories)
        .set(data)
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.projectId, projectId)
          )
        )
        .returning();

      // Sync category name onto expenses and draft rates if renamed
      if (data.name && data.name !== oldCat.name) {
        await tx
          .update(expenses)
          .set({ categoryName: data.name, updatedAt: new Date() })
          .where(
            and(
              eq(expenses.projectId, projectId),
              eq(expenses.categoryId, categoryId)
            )
          );

        const rates = { ...(owned.draftCategoryRates ?? {}) };
        if (Object.prototype.hasOwnProperty.call(rates, oldCat.name)) {
          rates[data.name] = rates[oldCat.name];
          delete rates[oldCat.name];
          await tx
            .update(projects)
            .set({ draftCategoryRates: rates, updatedAt: new Date() })
            .where(eq(projects.id, projectId));
        }
      }

      return updated;
    });
  } catch (error) {
    throw sanitizeDbError('updateCategoryForProject', error);
  }
}

export async function reorderCategoriesForProject(
  userId: number,
  projectId: number,
  orderedIds: number[]
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(categories)
          .set({ sortOrder: i + 1 })
          .where(
            and(
              eq(categories.id, orderedIds[i]),
              eq(categories.projectId, projectId)
            )
          );
      }
    });
    return true;
  } catch (error) {
    throw sanitizeDbError('reorderCategoriesForProject', error);
  }
}

export async function deleteCategoryForProject(
  userId: number,
  projectId: number,
  categoryId: number,
  targetCategoryId: number | null
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    await db.transaction(async (tx) => {
      if (targetCategoryId) {
        const targetRows = await tx
          .select()
          .from(categories)
          .where(
            and(
              eq(categories.id, targetCategoryId),
              eq(categories.projectId, projectId)
            )
          )
          .limit(1);
        if (targetRows[0]) {
          await tx
            .update(expenses)
            .set({
              categoryId: targetRows[0].id,
              categoryName: targetRows[0].name,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(expenses.projectId, projectId),
                eq(expenses.categoryId, categoryId)
              )
            );
        }
      }

      await tx
        .delete(categories)
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.projectId, projectId)
          )
        );
    });
    return true;
  } catch (error) {
    throw sanitizeDbError('deleteCategoryForProject', error);
  }
}

export async function createExpensesForProject(
  userId: number,
  projectId: number,
  items: Array<{
    categoryName: string;
    subcategory: string;
    dateJalali: string;
    title: string;
    baseAmount: number;
    overridePercent?: number | null;
    source: string;
  }>,
  mode: 'append' | 'replace' = 'append'
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    return await db.transaction(async (tx) => {
      if (mode === 'replace') {
        await tx.delete(expenses).where(eq(expenses.projectId, projectId));
      }

      // Ensure any new categories / subcategories from Excel or manual entry exist
      const existingCats = await tx
        .select()
        .from(categories)
        .where(eq(categories.projectId, projectId));

      const catByName = new Map(existingCats.map((c) => [c.name, c]));
      let maxOrder = existingCats.reduce(
        (m, c) => Math.max(m, c.sortOrder),
        0
      );

      for (const item of items) {
        let cat = catByName.get(item.categoryName);
        if (!cat) {
          maxOrder += 1;
          const [createdCat] = await tx
            .insert(categories)
            .values({
              projectId,
              name: item.categoryName,
              sortOrder: maxOrder,
              subcategories: item.subcategory ? [item.subcategory] : [],
            })
            .returning();
          cat = createdCat;
          catByName.set(cat.name, cat);
        } else if (
          item.subcategory &&
          !cat.subcategories.includes(item.subcategory)
        ) {
          const updatedSubs = [...cat.subcategories, item.subcategory];
          const [updatedCat] = await tx
            .update(categories)
            .set({ subcategories: updatedSubs })
            .where(eq(categories.id, cat.id))
            .returning();
          cat = updatedCat;
          catByName.set(cat.name, cat);
        }
      }

      const inserted = await tx
        .insert(expenses)
        .values(
          items.map((item) => ({
            projectId,
            categoryId: catByName.get(item.categoryName)?.id ?? null,
            categoryName: item.categoryName,
            subcategory: item.subcategory ?? '',
            dateJalali: item.dateJalali,
            title: item.title,
            baseAmount: item.baseAmount,
            overridePercent: item.overridePercent ?? null,
            source: item.source,
          }))
        )
        .returning();

      const updatedCats = await tx
        .select()
        .from(categories)
        .where(eq(categories.projectId, projectId))
        .orderBy(asc(categories.sortOrder), asc(categories.id));

      return { inserted, categories: updatedCats };
    });
  } catch (error) {
    throw sanitizeDbError('createExpensesForProject', error);
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
    dateJalali: string;
    title: string;
    baseAmount: number;
    overridePercent: number | null;
  }>
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const [updated] = await db
      .update(expenses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(expenses.id, expenseId), eq(expenses.projectId, projectId))
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    throw sanitizeDbError('updateExpenseForProject', error);
  }
}

export async function bulkSetSubcategoryOverrideForProject(
  userId: number,
  projectId: number,
  categoryName: string,
  subcategory: string,
  overridePercent: number | null
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const updated = await db
      .update(expenses)
      .set({ overridePercent, updatedAt: new Date() })
      .where(
        and(
          eq(expenses.projectId, projectId),
          eq(expenses.categoryName, categoryName),
          eq(expenses.subcategory, subcategory)
        )
      )
      .returning();

    return updated;
  } catch (error) {
    throw sanitizeDbError('bulkSetSubcategoryOverrideForProject', error);
  }
}

export async function deleteExpenseForProject(
  userId: number,
  projectId: number,
  expenseId: number
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    await db
      .delete(expenses)
      .where(
        and(eq(expenses.id, expenseId), eq(expenses.projectId, projectId))
      );
    return true;
  } catch (error) {
    throw sanitizeDbError('deleteExpenseForProject', error);
  }
}

export async function createPricingVersionForProject(
  userId: number,
  projectId: number,
  payload: {
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
  }
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const [created] = await db
      .insert(pricingVersions)
      .values({
        projectId,
        ...payload,
      })
      .returning();

    return created;
  } catch (error) {
    throw sanitizeDbError('createPricingVersionForProject', error);
  }
}

export async function updatePricingVersionMetaForProject(
  userId: number,
  projectId: number,
  versionId: number,
  data: { name: string; versionDateJalali: string; description: string }
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return null;

    const [updated] = await db
      .update(pricingVersions)
      .set({
        name: data.name,
        versionDateJalali: data.versionDateJalali,
        description: data.description,
      })
      .where(
        and(
          eq(pricingVersions.id, versionId),
          eq(pricingVersions.projectId, projectId)
        )
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    throw sanitizeDbError('updatePricingVersionMetaForProject', error);
  }
}

export async function deletePricingVersionForProject(
  userId: number,
  projectId: number,
  versionId: number
) {
  try {
    const owned = await assertProjectOwnership(projectId, userId);
    if (!owned) return false;

    await db
      .delete(pricingVersions)
      .where(
        and(
          eq(pricingVersions.id, versionId),
          eq(pricingVersions.projectId, projectId)
        )
      );
    return true;
  } catch (error) {
    throw sanitizeDbError('deletePricingVersionForProject', error);
  }
}
