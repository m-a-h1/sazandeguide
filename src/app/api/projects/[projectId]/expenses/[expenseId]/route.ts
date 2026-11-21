import { NextRequest, NextResponse } from 'next/server';
import {
  deleteExpenseForProject,
  updateExpenseForProject,
} from '../../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../../lib/serverAuth';
import { parseJalaliDate } from '../../../../../../utils/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; expenseId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, expenseId: rawExpenseId } =
      await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const expenseId = parsePositiveIntId(rawExpenseId);
    if (!projectId || !expenseId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا هزینه نامعتبر است.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (typeof body.categoryName === 'string' && body.categoryName.trim()) {
      updates.categoryName = body.categoryName.trim();
    }
    if (body.categoryId !== undefined) {
      updates.categoryId =
        typeof body.categoryId === 'number' && Number.isInteger(body.categoryId)
          ? body.categoryId
          : null;
    }
    if (typeof body.subcategory === 'string') {
      updates.subcategory = body.subcategory.trim();
    }
    if (typeof body.title === 'string') {
      if (!body.title.trim()) {
        return NextResponse.json(
          { error: 'نام هزینه الزامی است.' },
          { status: 400 }
        );
      }
      updates.title = body.title.trim();
    }
    if (typeof body.dateJalali === 'string') {
      const check = parseJalaliDate(body.dateJalali);
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      updates.dateJalali = check.normalized;
    }
    if (typeof body.baseAmount === 'number') {
      if (!Number.isFinite(body.baseAmount) || body.baseAmount < 0) {
        return NextResponse.json(
          { error: 'مبلغ پایه نامعتبر است.' },
          { status: 400 }
        );
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
      auth.dbUserId,
      projectId,
      expenseId,
      updates
    );
    if (!updated) {
      return NextResponse.json(
        { error: 'ردیف هزینه یافت نشد.' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'خطا در ویرایش هزینه.');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; expenseId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, expenseId: rawExpenseId } =
      await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const expenseId = parsePositiveIntId(rawExpenseId);
    if (!projectId || !expenseId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا هزینه نامعتبر است.' },
        { status: 400 }
      );
    }

    const ok = await deleteExpenseForProject(
      auth.dbUserId,
      projectId,
      expenseId
    );
    if (!ok) {
      return NextResponse.json({ error: 'هزینه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در حذف هزینه.');
  }
}
