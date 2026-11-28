import { NextRequest, NextResponse } from 'next/server';
import {
  createTagForProject,
  listTagsForProject,
  TagConflictError,
} from '../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../lib/serverAuth';
import { validateTagInput } from '../../../../../utils/detailedExpense';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
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

    const tags = await listTagsForProject(auth.dbUserId, projectId);
    if (!tags) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ tags });
  } catch (error) {
    return handleRouteError(error, 'خطا در دریافت فهرست برچسب‌ها.');
  }
}

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
    const check = validateTagInput(body?.name, body?.percentAdjustment ?? 0);
    if (!check.valid || !check.name) {
      return NextResponse.json(
        { error: check.error || 'اطلاعات برچسب نامعتبر است.' },
        { status: 400 }
      );
    }

    const created = await createTagForProject(auth.dbUserId, projectId, {
      name: check.name,
      percentAdjustment: check.percentAdjustment ?? 0,
    });
    if (!created) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof TagConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleRouteError(error, 'خطا در ایجاد برچسب جدید.');
  }
}
