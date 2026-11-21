import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  bulkSetSubcategoryOverrideForProject,
  createCategoryForProject,
  createExpensesForProject,
  createPricingVersionForProject,
  createProjectForUser,
  deleteCategoryForProject,
  deleteExpenseForProject,
  deletePricingVersionForProject,
  deleteProjectForUser,
  getOrSeedUserWorkspace,
  reorderCategoriesForProject,
  updateCategoryForProject,
  updateExpenseForProject,
  updatePricingVersionMetaForProject,
  updateProjectForUser,
} from './src/db/projectsRepo.ts';
import { parseJalaliDate } from './src/utils/jalali.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '5mb' }));

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Workspace bootstrap (protected by Firebase Auth)
app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
  try {
    const workspace = await getOrSeedUserWorkspace(req.dbUserId!);
    res.json(workspace);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'خطا در دریافت اطلاعات.';
    res.status(500).json({ error: message });
  }
});

// Projects CRUD
app.post('/api/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      address,
      description,
      areaSqm,
      usefulAreaSqm,
      floors,
      units,
      startDateJalali,
      endDateJalali,
      status,
      currency,
      taxPercent,
      landPrice,
      partnershipPercent,
    } = req.body ?? {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'نام پروژه الزامی است.' });
    }
    if (
      areaSqm !== undefined &&
      areaSqm !== null &&
      (typeof areaSqm !== 'number' || !Number.isFinite(areaSqm) || areaSqm <= 0)
    ) {
      return res
        .status(400)
        .json({ error: 'متراژ زیربنای کل باید عددی مثبت باشد.' });
    }
    if (
      usefulAreaSqm !== undefined &&
      usefulAreaSqm !== null &&
      (typeof usefulAreaSqm !== 'number' ||
        !Number.isFinite(usefulAreaSqm) ||
        usefulAreaSqm <= 0)
    ) {
      return res
        .status(400)
        .json({ error: 'متراژ زیربنای مفید باید عددی مثبت باشد.' });
    }
    if (
      taxPercent !== undefined &&
      (typeof taxPercent !== 'number' ||
        !Number.isFinite(taxPercent) ||
        taxPercent < 0 ||
        taxPercent > 100)
    ) {
      return res
        .status(400)
        .json({ error: 'درصد مالیات باید عددی بین ۰ تا ۱۰۰ باشد.' });
    }
    if (
      landPrice !== undefined &&
      landPrice !== null &&
      (typeof landPrice !== 'number' ||
        !Number.isFinite(landPrice) ||
        landPrice < 0)
    ) {
      return res
        .status(400)
        .json({ error: 'قیمت زمین نمی‌تواند منفی یا نامعتبر باشد.' });
    }
    if (
      partnershipPercent !== undefined &&
      partnershipPercent !== null &&
      (typeof partnershipPercent !== 'number' ||
        !Number.isFinite(partnershipPercent) ||
        partnershipPercent <= 0 ||
        partnershipPercent > 100)
    ) {
      return res.status(400).json({
        error: 'درصد مشارکت باید عددی بزرگ‌تر از ۰ و حداکثر ۱۰۰ باشد.',
      });
    }
    if (startDateJalali) {
      const check = parseJalaliDate(startDateJalali);
      if (!check.valid) {
        return res
          .status(400)
          .json({ error: `تاریخ شروع نامعتبر است: ${check.error}` });
      }
    }
    if (endDateJalali) {
      const check = parseJalaliDate(endDateJalali);
      if (!check.valid) {
        return res
          .status(400)
          .json({ error: `تاریخ پایان نامعتبر است: ${check.error}` });
      }
    }

    const result = await createProjectForUser(req.dbUserId!, {
      name: name.trim(),
      address: typeof address === 'string' ? address.trim() : '',
      description: typeof description === 'string' ? description.trim() : '',
      areaSqm:
        typeof areaSqm === 'number' && areaSqm > 0 ? areaSqm : null,
      usefulAreaSqm:
        typeof usefulAreaSqm === 'number' && usefulAreaSqm > 0
          ? usefulAreaSqm
          : null,
      floors:
        typeof floors === 'number' && Number.isInteger(floors) && floors >= 0
          ? floors
          : null,
      units:
        typeof units === 'number' && Number.isInteger(units) && units >= 0
          ? units
          : null,
      startDateJalali:
        typeof startDateJalali === 'string' ? startDateJalali.trim() : '',
      endDateJalali:
        typeof endDateJalali === 'string' ? endDateJalali.trim() : '',
      status:
        status === 'تکمیل‌شده' || status === 'متوقف‌شده'
          ? status
          : 'در حال ساخت',
      currency:
        currency === 'ریال' || currency === 'تعیین‌نشده' ? currency : 'تومان',
      taxPercent: typeof taxPercent === 'number' ? taxPercent : 0,
      landPrice: typeof landPrice === 'number' ? landPrice : 0,
      partnershipPercent:
        typeof partnershipPercent === 'number' ? partnershipPercent : null,
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'خطا در ایجاد پروژه.';
    res.status(500).json({ error: message });
  }
});

app.patch('/api/projects/:projectId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'شناسهٔ پروژه نامعتبر است.' });
    }

    const body = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      if (!body.name.trim()) {
        return res.status(400).json({ error: 'نام پروژه نمی‌تواند خالی باشد.' });
      }
      updates.name = body.name.trim();
    }
    if (typeof body.address === 'string') updates.address = body.address.trim();
    if (typeof body.description === 'string')
      updates.description = body.description.trim();
    if (body.areaSqm !== undefined) {
      if (
        body.areaSqm !== null &&
        (typeof body.areaSqm !== 'number' ||
          !Number.isFinite(body.areaSqm) ||
          body.areaSqm <= 0)
      ) {
        return res
          .status(400)
          .json({ error: 'متراژ زیربنای کل باید عددی مثبت باشد.' });
      }
      updates.areaSqm =
        typeof body.areaSqm === 'number' && body.areaSqm > 0
          ? body.areaSqm
          : null;
    }
    if (body.usefulAreaSqm !== undefined) {
      if (
        body.usefulAreaSqm !== null &&
        (typeof body.usefulAreaSqm !== 'number' ||
          !Number.isFinite(body.usefulAreaSqm) ||
          body.usefulAreaSqm <= 0)
      ) {
        return res
          .status(400)
          .json({ error: 'متراژ زیربنای مفید باید عددی مثبت باشد.' });
      }
      updates.usefulAreaSqm =
        typeof body.usefulAreaSqm === 'number' && body.usefulAreaSqm > 0
          ? body.usefulAreaSqm
          : null;
    }
    if (body.floors !== undefined) {
      updates.floors =
        typeof body.floors === 'number' && body.floors >= 0
          ? Math.trunc(body.floors)
          : null;
    }
    if (body.units !== undefined) {
      updates.units =
        typeof body.units === 'number' && body.units >= 0
          ? Math.trunc(body.units)
          : null;
    }
    if (typeof body.startDateJalali === 'string') {
      if (body.startDateJalali.trim()) {
        const check = parseJalaliDate(body.startDateJalali);
        if (!check.valid) {
          return res
            .status(400)
            .json({ error: `تاریخ شروع نامعتبر است: ${check.error}` });
        }
        updates.startDateJalali = check.normalized;
      } else {
        updates.startDateJalali = '';
      }
    }
    if (typeof body.endDateJalali === 'string') {
      if (body.endDateJalali.trim()) {
        const check = parseJalaliDate(body.endDateJalali);
        if (!check.valid) {
          return res
            .status(400)
            .json({ error: `تاریخ پایان نامعتبر است: ${check.error}` });
        }
        updates.endDateJalali = check.normalized;
      } else {
        updates.endDateJalali = '';
      }
    }
    if (
      body.status === 'در حال ساخت' ||
      body.status === 'تکمیل‌شده' ||
      body.status === 'متوقف‌شده'
    ) {
      updates.status = body.status;
    }
    if (
      body.currency === 'تومان' ||
      body.currency === 'ریال' ||
      body.currency === 'تعیین‌نشده'
    ) {
      updates.currency = body.currency;
    }
    if (body.taxPercent !== undefined) {
      if (
        typeof body.taxPercent !== 'number' ||
        !Number.isFinite(body.taxPercent) ||
        body.taxPercent < 0 ||
        body.taxPercent > 100
      ) {
        return res
          .status(400)
          .json({ error: 'درصد مالیات باید عددی بین ۰ تا ۱۰۰ باشد.' });
      }
      updates.taxPercent = body.taxPercent;
    }
    if (body.landPrice !== undefined) {
      if (
        body.landPrice !== null &&
        (typeof body.landPrice !== 'number' ||
          !Number.isFinite(body.landPrice) ||
          body.landPrice < 0)
      ) {
        return res
          .status(400)
          .json({ error: 'قیمت زمین نمی‌تواند منفی یا نامعتبر باشد.' });
      }
      updates.landPrice = typeof body.landPrice === 'number' ? body.landPrice : 0;
    }
    if (body.partnershipPercent !== undefined) {
      if (
        body.partnershipPercent !== null &&
        (typeof body.partnershipPercent !== 'number' ||
          !Number.isFinite(body.partnershipPercent) ||
          body.partnershipPercent <= 0 ||
          body.partnershipPercent > 100)
      ) {
        return res.status(400).json({
          error: 'درصد مشارکت باید عددی بزرگ‌تر از ۰ و حداکثر ۱۰۰ باشد.',
        });
      }
      updates.partnershipPercent =
        typeof body.partnershipPercent === 'number'
          ? body.partnershipPercent
          : null;
    }
    if (
      body.draftCategoryRates &&
      typeof body.draftCategoryRates === 'object' &&
      !Array.isArray(body.draftCategoryRates)
    ) {
      const cleanedRates: Record<string, number> = {};
      for (const [k, v] of Object.entries(body.draftCategoryRates)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          cleanedRates[k] = v;
        }
      }
      updates.draftCategoryRates = cleanedRates;
    }

    const updated = await updateProjectForUser(
      req.dbUserId!,
      projectId,
      updates
    );
    if (!updated) {
      return res.status(404).json({ error: 'پروژه یافت نشد.' });
    }
    res.json(updated);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'خطا در ویرایش پروژه.';
    res.status(500).json({ error: message });
  }
});

app.delete(
  '/api/projects/:projectId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ error: 'شناسهٔ پروژه نامعتبر است.' });
      }
      const deleted = await deleteProjectForUser(req.dbUserId!, projectId);
      if (!deleted) {
        return res.status(404).json({ error: 'پروژه یافت نشد.' });
      }
      res.json({ ok: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در حذف پروژه.';
      res.status(500).json({ error: message });
    }
  }
);

// Categories CRUD
app.post(
  '/api/projects/:projectId/categories',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const { name, subcategories } = req.body ?? {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'نام دسته الزامی است.' });
      }
      const subs = Array.isArray(subcategories)
        ? subcategories
            .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            .map((s) => s.trim())
        : [];
      const created = await createCategoryForProject(req.dbUserId!, projectId, {
        name: name.trim(),
        subcategories: subs,
      });
      if (!created) {
        return res.status(404).json({ error: 'پروژه یافت نشد.' });
      }
      res.status(201).json(created);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ایجاد دسته.';
      res.status(500).json({ error: message });
    }
  }
);

app.patch(
  '/api/projects/:projectId/categories/reorder',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const { orderedIds } = req.body ?? {};
      if (
        !Array.isArray(orderedIds) ||
        orderedIds.some((id) => typeof id !== 'number')
      ) {
        return res.status(400).json({ error: 'ترتیب دسته‌ها نامعتبر است.' });
      }
      const ok = await reorderCategoriesForProject(
        req.dbUserId!,
        projectId,
        orderedIds
      );
      if (!ok) return res.status(404).json({ error: 'پروژه یافت نشد.' });
      res.json({ ok: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در جابه‌جایی دسته‌ها.';
      res.status(500).json({ error: message });
    }
  }
);

app.patch(
  '/api/projects/:projectId/categories/:categoryId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const categoryId = Number(req.params.categoryId);
      const { name, subcategories, sortOrder } = req.body ?? {};
      const updates: Record<string, unknown> = {};
      if (typeof name === 'string' && name.trim()) updates.name = name.trim();
      if (Array.isArray(subcategories)) {
        updates.subcategories = subcategories
          .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
          .map((s) => s.trim());
      }
      if (typeof sortOrder === 'number') updates.sortOrder = sortOrder;

      const updated = await updateCategoryForProject(
        req.dbUserId!,
        projectId,
        categoryId,
        updates
      );
      if (!updated) {
        return res.status(404).json({ error: 'دسته یافت نشد.' });
      }
      res.json(updated);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ویرایش دسته.';
      res.status(500).json({ error: message });
    }
  }
);

app.delete(
  '/api/projects/:projectId/categories/:categoryId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const categoryId = Number(req.params.categoryId);
      const targetCategoryId =
        typeof req.body?.targetCategoryId === 'number'
          ? req.body.targetCategoryId
          : null;
      const ok = await deleteCategoryForProject(
        req.dbUserId!,
        projectId,
        categoryId,
        targetCategoryId
      );
      if (!ok) {
        return res.status(404).json({ error: 'دسته یافت نشد.' });
      }
      res.json({ ok: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در حذف دسته.';
      res.status(500).json({ error: message });
    }
  }
);

// Expenses CRUD + Batch Excel import
app.post(
  '/api/projects/:projectId/expenses',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const { items, mode } = req.body ?? {};
      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ error: 'حداقل یک ردیف هزینه باید ارسال شود.' });
      }

      const validatedItems: Array<{
        categoryName: string;
        subcategory: string;
        dateJalali: string;
        title: string;
        baseAmount: number;
        overridePercent?: number | null;
        source: string;
      }> = [];

      for (const raw of items) {
        const categoryName = String(raw?.categoryName ?? '').trim();
        const subcategory = String(raw?.subcategory ?? '').trim();
        const title = String(raw?.title ?? '').trim();
        const dateCheck = parseJalaliDate(String(raw?.dateJalali ?? ''));
        const baseAmount = Number(raw?.baseAmount);

        if (!categoryName || !title || !dateCheck.valid || !Number.isFinite(baseAmount) || baseAmount < 0) {
          return res.status(400).json({
            error: 'اطلاعات یکی از ردیف‌های هزینه نامعتبر یا ناقص است.',
          });
        }

        validatedItems.push({
          categoryName,
          subcategory,
          dateJalali: dateCheck.normalized!,
          title,
          baseAmount,
          overridePercent:
            typeof raw?.overridePercent === 'number' &&
            Number.isFinite(raw.overridePercent)
              ? raw.overridePercent
              : null,
          source:
            raw?.source === 'اکسل' || raw?.source === 'نمونه'
              ? raw.source
              : 'دستی',
        });
      }

      const result = await createExpensesForProject(
        req.dbUserId!,
        projectId,
        validatedItems,
        mode === 'replace' ? 'replace' : 'append'
      );
      if (!result) {
        return res.status(404).json({ error: 'پروژه یافت نشد.' });
      }
      res.status(201).json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ثبت هزینه‌ها.';
      res.status(500).json({ error: message });
    }
  }
);

app.patch(
  '/api/projects/:projectId/expenses/:expenseId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const expenseId = Number(req.params.expenseId);
      const body = req.body ?? {};
      const updates: Record<string, unknown> = {};

      if (typeof body.categoryName === 'string' && body.categoryName.trim()) {
        updates.categoryName = body.categoryName.trim();
      }
      if (body.categoryId !== undefined) {
        updates.categoryId =
          typeof body.categoryId === 'number' ? body.categoryId : null;
      }
      if (typeof body.subcategory === 'string') {
        updates.subcategory = body.subcategory.trim();
      }
      if (typeof body.title === 'string') {
        if (!body.title.trim()) {
          return res.status(400).json({ error: 'نام هزینه الزامی است.' });
        }
        updates.title = body.title.trim();
      }
      if (typeof body.dateJalali === 'string') {
        const check = parseJalaliDate(body.dateJalali);
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
        updates.dateJalali = check.normalized;
      }
      if (typeof body.baseAmount === 'number') {
        if (!Number.isFinite(body.baseAmount) || body.baseAmount < 0) {
          return res.status(400).json({ error: 'مبلغ پایه نامعتبر است.' });
        }
        updates.baseAmount = body.baseAmount;
      }
      if (body.overridePercent !== undefined) {
        updates.overridePercent =
          typeof body.overridePercent === 'number' &&
          Number.isFinite(body.overridePercent)
            ? body.overridePercent
            : null;
      }

      const updated = await updateExpenseForProject(
        req.dbUserId!,
        projectId,
        expenseId,
        updates
      );
      if (!updated) {
        return res.status(404).json({ error: 'ردیف هزینه یافت نشد.' });
      }
      res.json(updated);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ویرایش هزینه.';
      res.status(500).json({ error: message });
    }
  }
);

app.post(
  '/api/projects/:projectId/expenses/subcategory-override',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const { categoryName, subcategory, overridePercent } = req.body ?? {};
      if (!categoryName || typeof categoryName !== 'string') {
        return res.status(400).json({ error: 'نام دسته الزامی است.' });
      }
      const pct =
        typeof overridePercent === 'number' && Number.isFinite(overridePercent)
          ? overridePercent
          : null;
      const updated = await bulkSetSubcategoryOverrideForProject(
        req.dbUserId!,
        projectId,
        categoryName,
        String(subcategory ?? ''),
        pct
      );
      if (!updated) {
        return res.status(404).json({ error: 'پروژه یافت نشد.' });
      }
      res.json({ updated });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در به‌روزرسانی نرخ زیردسته.';
      res.status(500).json({ error: message });
    }
  }
);

app.delete(
  '/api/projects/:projectId/expenses/:expenseId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const expenseId = Number(req.params.expenseId);
      const ok = await deleteExpenseForProject(
        req.dbUserId!,
        projectId,
        expenseId
      );
      if (!ok) {
        return res.status(404).json({ error: 'هزینه یافت نشد.' });
      }
      res.json({ ok: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در حذف هزینه.';
      res.status(500).json({ error: message });
    }
  }
);

// Pricing Versions CRUD
app.post(
  '/api/projects/:projectId/versions',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const body = req.body ?? {};
      const dateCheck = parseJalaliDate(String(body.versionDateJalali ?? ''));
      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        return res.status(400).json({ error: 'نام نسخه الزامی است.' });
      }
      if (!dateCheck.valid) {
        return res
          .status(400)
          .json({ error: `تاریخ نسخه نامعتبر است: ${dateCheck.error}` });
      }

      const created = await createPricingVersionForProject(
        req.dbUserId!,
        projectId,
        {
          name: body.name.trim(),
          versionDateJalali: dateCheck.normalized!,
          description:
            typeof body.description === 'string' ? body.description.trim() : '',
          baseReferenceType:
            body.baseReferenceType === 'VERSION' ? 'VERSION' : 'BASE',
          parentVersionId:
            typeof body.parentVersionId === 'number'
              ? body.parentVersionId
              : null,
          parentVersionName:
            typeof body.parentVersionName === 'string'
              ? body.parentVersionName
              : null,
          categoryRatesSnapshot: body.categoryRatesSnapshot ?? {},
          taxPercentSnapshot:
            typeof body.taxPercentSnapshot === 'number' &&
            Number.isFinite(body.taxPercentSnapshot) &&
            body.taxPercentSnapshot >= 0
              ? body.taxPercentSnapshot
              : 0,
          landPriceSnapshot:
            typeof body.landPriceSnapshot === 'number' &&
            Number.isFinite(body.landPriceSnapshot) &&
            body.landPriceSnapshot >= 0
              ? body.landPriceSnapshot
              : 0,
          partnershipPercentSnapshot:
            typeof body.partnershipPercentSnapshot === 'number' &&
            Number.isFinite(body.partnershipPercentSnapshot) &&
            body.partnershipPercentSnapshot > 0 &&
            body.partnershipPercentSnapshot <= 100
              ? body.partnershipPercentSnapshot
              : null,
          totalBaseAmount: Number(body.totalBaseAmount) || 0,
          totalReferenceAmount: Number(body.totalReferenceAmount) || 0,
          totalEstimatedAmount: Number(body.totalEstimatedAmount) || 0,
          diffFromBaseAmount: Number(body.diffFromBaseAmount) || 0,
          diffFromBasePercent: Number(body.diffFromBasePercent) || 0,
          itemsSnapshot: Array.isArray(body.itemsSnapshot)
            ? body.itemsSnapshot
            : [],
        }
      );

      if (!created) {
        return res.status(404).json({ error: 'پروژه یافت نشد.' });
      }
      res.status(201).json(created);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ذخیره نسخه.';
      res.status(500).json({ error: message });
    }
  }
);

app.patch(
  '/api/projects/:projectId/versions/:versionId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const versionId = Number(req.params.versionId);
      const { name, versionDateJalali, description } = req.body ?? {};
      const dateCheck = parseJalaliDate(String(versionDateJalali ?? ''));
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'نام نسخه الزامی است.' });
      }
      if (!dateCheck.valid) {
        return res
          .status(400)
          .json({ error: `تاریخ نسخه نامعتبر است: ${dateCheck.error}` });
      }
      const updated = await updatePricingVersionMetaForProject(
        req.dbUserId!,
        projectId,
        versionId,
        {
          name: name.trim(),
          versionDateJalali: dateCheck.normalized!,
          description: typeof description === 'string' ? description.trim() : '',
        }
      );
      if (!updated) {
        return res.status(404).json({ error: 'نسخه یافت نشد.' });
      }
      res.json(updated);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ویرایش نسخه.';
      res.status(500).json({ error: message });
    }
  }
);

app.delete(
  '/api/projects/:projectId/versions/:versionId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const versionId = Number(req.params.versionId);
      const ok = await deletePricingVersionForProject(
        req.dbUserId!,
        projectId,
        versionId
      );
      if (!ok) {
        return res.status(404).json({ error: 'نسخه یافت نشد.' });
      }
      res.json({ ok: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در حذف نسخه.';
      res.status(500).json({ error: message });
    }
  }
);

// Server-side Gemini Intelligence Routes (no DB touch, works with project data payload)
app.post('/api/ai/analyze-project', async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'کلید سرویس هوش مصنوعی تنظیم نشده است. لطفاً کلید را در تنظیمات محیطی اضافه کنید.',
      });
    }

    const {
      projectName,
      currency,
      areaSqm,
      totalBaseAmount,
      totalEstimatedAmount,
      diffPercent,
      versionName,
      categoryBreakdown,
      topItems,
    } = req.body ?? {};

    if (!projectName || !Array.isArray(categoryBreakdown)) {
      return res
        .status(400)
        .json({ error: 'اطلاعات پروژه برای تحلیل ناقص است.' });
    }

    const prompt = `
شما یک مدیر پروژه و برآوردگر ارشد هزینه‌های ساختمانی در ایران هستید.
فقط به زبان فارسی رسمی و دقیق پاسخ بده. هیچ واژهٔ انگلیسی در خروجی استفاده نکن.
اطلاعات پروژه:
- نام پروژه: ${String(projectName)}
- نسخهٔ مورد بررسی: ${String(versionName || 'پیش‌نویس کاری')}
- واحد پول: ${String(currency || 'تعیین‌نشده')}
- متراژ زیربنا: ${areaSqm ? `${areaSqm} مترمربع` : 'ثبت‌نشده'}
- جمع قیمت پایه: ${Math.round(Number(totalBaseAmount) || 0)}
- جمع قیمت برآوردی: ${Math.round(Number(totalEstimatedAmount) || 0)}
- درصد تغییر کل: ${Number(diffPercent || 0).toFixed(2)}٪

سهم دسته‌های اصلی:
${categoryBreakdown
  .slice(0, 10)
  .map(
    (c: { categoryName: string; baseAmount: number; estimatedAmount: number; shareOfEstimatedPercent: number }) =>
      `- ${c.categoryName}: پایه ${Math.round(c.baseAmount)} | برآوردی ${Math.round(c.estimatedAmount)} (${c.shareOfEstimatedPercent.toFixed(1)}٪)`
  )
  .join('\n')}

بزرگ‌ترین اقلام هزینه:
${Array.isArray(topItems)
  ? topItems
      .slice(0, 8)
      .map(
        (i: { title: string; categoryName: string; estimatedAmount: number; effectivePercent: number }) =>
          `- ${i.title} (${i.categoryName}): ${Math.round(i.estimatedAmount)} با نرخ ${i.effectivePercent}٪`
      )
      .join('\n')
  : ''}

لطفاً یک تحلیل مدیریتی دقیق، کاربردی و کوتاه دربارهٔ ساختار هزینه‌ها، ریسک‌های تورمی و پیشنهادهای کنترل هزینه ارائه بده.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'تحلیلگر ارشد هزینه‌های ساختمانی. پاسخ‌ها کوتاه، عددی، دقیق و تماماً فارسی بدون کلمات انگلیسی باشد.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'خلاصه مدیریتی وضعیت هزینه و برآورد پروژه به فارسی',
            },
            keyDrivers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'مهم‌ترین پیشران‌های هزینه در پروژه (۳ مورد)',
            },
            riskWarnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'ریسک‌های تورمی و نقاط حساس هزینه (۲ تا ۳ مورد)',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'پیشنهادهای اجرایی برای مدیریت و بهینه‌سازی هزینه (۳ مورد)',
            },
          },
          required: ['summary', 'keyDrivers', 'riskWarnings', 'recommendations'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error: unknown) {
    console.error('Gemini analyze-project failed:', error);
    res.status(502).json({
      error: 'دریافت تحلیل هوشمند با خطا مواجه شد. لطفاً لحظاتی دیگر دوباره تلاش کنید.',
    });
  }
});

app.post('/api/ai/suggest-category', async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'کلید سرویس هوش مصنوعی تنظیم نشده است.',
      });
    }

    const { title, categoriesList } = req.body ?? {};
    if (!title || typeof title !== 'string' || !Array.isArray(categoriesList)) {
      return res.status(400).json({ error: 'نام هزینه و فهرست دسته‌ها الزامی است.' });
    }

    const prompt = `نام هزینه: «${title.trim()}»
دسته‌ها و زیرمجموعه‌های موجود در پروژه:
${categoriesList
  .map(
    (c: { name: string; subcategories: string[] }) =>
      `- ${c.name}: [${(c.subcategories ?? []).join('، ')}]`
  )
  .join('\n')}

بهترین دسته اصلی و زیردستهٔ مناسب برای این هزینه را فقط از میان فهرست بالا یا با یک زیردستهٔ دقیق فارسی پیشنهاد بده.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction:
          'فقط به فارسی پاسخ بده و دقیقاً یک دسته اصلی از فهرست موجود انتخاب کن.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryName: { type: Type.STRING },
            subcategory: { type: Type.STRING },
          },
          required: ['categoryName', 'subcategory'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (error: unknown) {
    console.error('Gemini suggest-category failed:', error);
    res.status(502).json({
      error: 'پیشنهاد دسته‌بندی هوشمند در حال حاضر در دسترس نیست.',
    });
  }
});

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
