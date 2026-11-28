import { NextRequest, NextResponse } from 'next/server';
import { createExpensesForProject } from '../../../../../db/projectsRepo';
import { isKeyOwnedByProject } from '../../../../../lib/s3';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../lib/serverAuth';
import type {
  ExpenseEntryMode,
  ExpenseImageAttachment,
  ExpenseUnitType,
  WeightUnit,
} from '../../../../../types/app';
import { validateDetailedExpenseInput } from '../../../../../utils/detailedExpense';
import { parseJalaliDate } from '../../../../../utils/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId } = await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    if (!projectId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه نامعتبر است.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { items, mode } = body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'حداقل یک ردیف هزینه باید ارسال شود.' },
        { status: 400 }
      );
    }

    const validatedItems: Array<{
      categoryName: string;
      subcategory: string;
      tagId?: number | null;
      dateJalali: string;
      title: string;
      baseAmount: number;
      overridePercent?: number | null;
      source: string;
      entryMode: ExpenseEntryMode;
      unitType: ExpenseUnitType | null;
      quantity: number | null;
      itemCount: number | null;
      weightUnit: WeightUnit | null;
      unitPrice: number | null;
      description: string;
      images: ExpenseImageAttachment[];
    }> = [];

    for (const raw of items) {
      const categoryName =
        typeof raw?.categoryName === 'string' ? raw.categoryName.trim() : '';
      const subcategory =
        typeof raw?.subcategory === 'string' ? raw.subcategory.trim() : '';
      const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
      const dateRaw =
        typeof raw?.dateJalali === 'string' ? raw.dateJalali : '';
      const dateCheck = parseJalaliDate(dateRaw);

      if (!categoryName || !title || !dateCheck.valid) {
        return NextResponse.json(
          { error: 'اطلاعات یکی از ردیف‌های هزینه نامعتبر یا ناقص است.' },
          { status: 400 }
        );
      }

      const parsedTagId =
        typeof raw?.tagId === 'number' &&
        Number.isInteger(raw.tagId) &&
        raw.tagId > 0
          ? raw.tagId
          : null;

      const isDetailed =
        raw?.entryMode === 'detailed' ||
        raw?.source === 'جزئیات' ||
        (raw?.unitType !== undefined && raw?.unitType !== null);

      if (isDetailed) {
        const detailedCheck = validateDetailedExpenseInput({
          unitType: raw?.unitType,
          quantity: raw?.quantity,
          itemCount: raw?.itemCount,
          weightUnit: raw?.weightUnit,
          unitPrice: raw?.unitPrice,
          description: raw?.description,
          images: raw?.images,
        });

        if (!detailedCheck.valid || !detailedCheck.data) {
          return NextResponse.json(
            { error: detailedCheck.error || 'اطلاعات هزینهٔ جزئی نامعتبر است.' },
            { status: 400 }
          );
        }

        const safeImages = detailedCheck.data.images.filter((img) =>
          isKeyOwnedByProject(projectId, img.key)
        );

        validatedItems.push({
          categoryName,
          subcategory,
          tagId: parsedTagId,
          dateJalali: dateCheck.normalized!,
          title,
          baseAmount: detailedCheck.data.computedBaseAmount,
          overridePercent:
            typeof raw?.overridePercent === 'number' &&
            Number.isFinite(raw.overridePercent)
              ? raw.overridePercent
              : null,
          source: 'جزئیات',
          entryMode: 'detailed',
          unitType: detailedCheck.data.unitType,
          quantity: detailedCheck.data.quantity,
          itemCount: detailedCheck.data.itemCount,
          weightUnit: detailedCheck.data.weightUnit,
          unitPrice: detailedCheck.data.unitPrice,
          description: detailedCheck.data.description,
          images: safeImages,
        });
      } else {
        const baseAmount = Number(raw?.baseAmount);
        if (!Number.isFinite(baseAmount) || baseAmount < 0) {
          return NextResponse.json(
            { error: 'مبلغ پایه یکی از ردیف‌های هزینه نامعتبر است.' },
            { status: 400 }
          );
        }

        validatedItems.push({
          categoryName,
          subcategory,
          tagId: parsedTagId,
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
          entryMode: 'general',
          unitType: null,
          quantity: null,
          itemCount: null,
          weightUnit: null,
          unitPrice: null,
          description:
            typeof raw?.description === 'string'
              ? raw.description.trim().slice(0, 2000)
              : '',
          images: [],
        });
      }
    }

    const result = await createExpensesForProject(
      auth.dbUserId,
      projectId,
      validatedItems,
      mode === 'replace' ? 'replace' : 'append'
    );
    if (!result) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'خطا در ثبت هزینه‌ها.');
  }
}
