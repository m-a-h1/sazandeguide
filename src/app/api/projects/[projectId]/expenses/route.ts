import { NextRequest, NextResponse } from 'next/server';
import { createExpensesForProject } from '../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../lib/serverAuth';
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
      dateJalali: string;
      title: string;
      baseAmount: number;
      overridePercent?: number | null;
      source: string;
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
      const baseAmount = Number(raw?.baseAmount);

      if (
        !categoryName ||
        !title ||
        !dateCheck.valid ||
        !Number.isFinite(baseAmount) ||
        baseAmount < 0
      ) {
        return NextResponse.json(
          { error: 'اطلاعات یکی از ردیف‌های هزینه نامعتبر یا ناقص است.' },
          { status: 400 }
        );
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
