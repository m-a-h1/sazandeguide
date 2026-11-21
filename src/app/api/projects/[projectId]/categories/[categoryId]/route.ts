import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCategoryForProject,
  updateCategoryForProject,
} from '../../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; categoryId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, categoryId: rawCategoryId } =
      await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const categoryId = parsePositiveIntId(rawCategoryId);
    if (!projectId || !categoryId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا دسته نامعتبر است.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, subcategories, sortOrder } = body ?? {};
    const updates: Record<string, unknown> = {};

    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (Array.isArray(subcategories)) {
      updates.subcategories = subcategories
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .map((s) => s.trim());
    }
    if (typeof sortOrder === 'number' && Number.isFinite(sortOrder)) {
      updates.sortOrder = sortOrder;
    }

    const updated = await updateCategoryForProject(
      auth.dbUserId,
      projectId,
      categoryId,
      updates
    );
    if (!updated) {
      return NextResponse.json({ error: 'دسته یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'خطا در ویرایش دسته.');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; categoryId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, categoryId: rawCategoryId } =
      await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const categoryId = parsePositiveIntId(rawCategoryId);
    if (!projectId || !categoryId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا دسته نامعتبر است.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetCategoryId =
      typeof body?.targetCategoryId === 'number' &&
      Number.isInteger(body.targetCategoryId)
        ? body.targetCategoryId
        : null;

    const ok = await deleteCategoryForProject(
      auth.dbUserId,
      projectId,
      categoryId,
      targetCategoryId
    );
    if (!ok) {
      return NextResponse.json({ error: 'دسته یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در حذف دسته.');
  }
}
