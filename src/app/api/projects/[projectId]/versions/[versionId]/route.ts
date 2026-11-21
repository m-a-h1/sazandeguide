import { NextRequest, NextResponse } from 'next/server';
import {
  deletePricingVersionForProject,
  updatePricingVersionMetaForProject,
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
  context: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, versionId: rawVersionId } =
      await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const versionId = parsePositiveIntId(rawVersionId);
    if (!projectId || !versionId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا نسخه نامعتبر است.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, versionDateJalali, description } = body ?? {};
    const dateRaw =
      typeof versionDateJalali === 'string' ? versionDateJalali : '';
    const dateCheck = parseJalaliDate(dateRaw);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'نام نسخه الزامی است.' },
        { status: 400 }
      );
    }
    if (!dateCheck.valid) {
      return NextResponse.json(
        { error: `تاریخ نسخه نامعتبر است: ${dateCheck.error}` },
        { status: 400 }
      );
    }

    const updated = await updatePricingVersionMetaForProject(
      auth.dbUserId,
      projectId,
      versionId,
      {
        name: name.trim(),
        versionDateJalali: dateCheck.normalized!,
        description: typeof description === 'string' ? description.trim() : '',
      }
    );
    if (!updated) {
      return NextResponse.json({ error: 'نسخه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'خطا در ویرایش نسخه.');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const { projectId: rawProjectId, versionId: rawVersionId } =
      await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    const versionId = parsePositiveIntId(rawVersionId);
    if (!projectId || !versionId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه یا نسخه نامعتبر است.' },
        { status: 400 }
      );
    }

    const ok = await deletePricingVersionForProject(
      auth.dbUserId,
      projectId,
      versionId
    );
    if (!ok) {
      return NextResponse.json({ error: 'نسخه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در حذف نسخه.');
  }
}
