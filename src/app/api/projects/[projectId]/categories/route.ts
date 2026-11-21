import { NextRequest, NextResponse } from 'next/server';
import { createCategoryForProject } from '../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../lib/serverAuth';

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
    const { name, subcategories } = body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'نام دسته الزامی است.' },
        { status: 400 }
      );
    }

    const subs = Array.isArray(subcategories)
      ? subcategories
          .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
          .map((s) => s.trim())
      : [];

    const created = await createCategoryForProject(
      auth.dbUserId,
      projectId,
      {
        name: name.trim(),
        subcategories: subs,
      }
    );
    if (!created) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'خطا در ایجاد دسته.');
  }
}
