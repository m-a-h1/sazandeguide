import { NextRequest, NextResponse } from 'next/server';
import { reorderCategoriesForProject } from '../../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
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
    const { orderedIds } = body ?? {};
    if (
      !Array.isArray(orderedIds) ||
      orderedIds.some((id) => typeof id !== 'number' || !Number.isInteger(id))
    ) {
      return NextResponse.json(
        { error: 'ترتیب دسته‌ها نامعتبر است.' },
        { status: 400 }
      );
    }

    const ok = await reorderCategoriesForProject(
      auth.dbUserId,
      projectId,
      orderedIds
    );
    if (!ok) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در جابه‌جایی دسته‌ها.');
  }
}
