import { NextRequest, NextResponse } from 'next/server';
import {
  deleteTagForProject,
  TagConflictError,
  updateTagForProject,
} from '../../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../../lib/serverAuth';
import { validateTagInput } from '../../../../../../utils/detailedExpense';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; tagId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, tagId: rawTagId } = await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const tagId = parsePositiveIntId(rawTagId);
    if (!projectId || !tagId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا برچسب نامعتبر است.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updates: Partial<{ name: string; percentAdjustment: number }> = {};

    if (body?.name !== undefined) {
      const nameCheck = validateTagInput(body.name, 0);
      if (!nameCheck.valid || !nameCheck.name) {
        return NextResponse.json(
          { error: nameCheck.error || 'نام برچسب نامعتبر است.' },
          { status: 400 }
        );
      }
      updates.name = nameCheck.name;
    }

    if (body?.percentAdjustment !== undefined) {
      const pctCheck = validateTagInput('معتبر', body.percentAdjustment);
      if (!pctCheck.valid || pctCheck.percentAdjustment === undefined) {
        return NextResponse.json(
          { error: pctCheck.error || 'درصد برچسب نامعتبر است.' },
          { status: 400 }
        );
      }
      updates.percentAdjustment = pctCheck.percentAdjustment;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'حداقل یک فیلد برای ویرایش باید ارسال شود.' },
        { status: 400 }
      );
    }

    const updated = await updateTagForProject(
      auth.dbUserId,
      projectId,
      tagId,
      updates
    );
    if (!updated) {
      return NextResponse.json({ error: 'برچسب یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TagConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleRouteError(error, 'خطا در ویرایش برچسب.');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; tagId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, tagId: rawTagId } = await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const tagId = parsePositiveIntId(rawTagId);
    if (!projectId || !tagId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا برچسب نامعتبر است.' },
        { status: 400 }
      );
    }

    const ok = await deleteTagForProject(auth.dbUserId, projectId, tagId);
    if (!ok) {
      return NextResponse.json({ error: 'برچسب یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در حذف برچسب.');
  }
}
