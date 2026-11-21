import { NextRequest, NextResponse } from 'next/server';
import { bulkSetSubcategoryOverrideForProject } from '../../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../../lib/serverAuth';

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
    const { categoryName, subcategory, overridePercent } = body ?? {};
    if (!categoryName || typeof categoryName !== 'string' || !categoryName.trim()) {
      return NextResponse.json(
        { error: 'نام دسته الزامی است.' },
        { status: 400 }
      );
    }
    if (subcategory !== undefined && typeof subcategory !== 'string') {
      return NextResponse.json(
        { error: 'نام زیردسته نامعتبر است.' },
        { status: 400 }
      );
    }

    const pct =
      typeof overridePercent === 'number' && Number.isFinite(overridePercent)
        ? overridePercent
        : null;

    const updated = await bulkSetSubcategoryOverrideForProject(
      auth.dbUserId,
      projectId,
      categoryName.trim(),
      typeof subcategory === 'string' ? subcategory.trim() : '',
      pct
    );
    if (!updated) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ updated });
  } catch (error) {
    return handleRouteError(error, 'خطا در به‌روزرسانی نرخ زیردسته.');
  }
}
