import { NextRequest, NextResponse } from 'next/server';
import {
  deleteBuilderAccount,
  updateBuilderAccount,
} from '../../../../../db/buildersRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireSuperAdmin,
} from '../../../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ builderId: string }> }
) {
  const { admin, response } = await requireSuperAdmin(request);
  if (response || !admin) return response!;

  try {
    const { builderId: rawId } = await context.params;
    const builderId = parsePositiveIntId(rawId);
    if (!builderId) {
      return NextResponse.json(
        { error: 'شناسهٔ سازنده نامعتبر است.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updates: {
      displayName?: string;
      password?: string;
      isActive?: boolean;
    } = {};

    if (typeof body?.name === 'string') {
      const cleanName = body.name.trim();
      if (cleanName.length < 2) {
        return NextResponse.json(
          { error: 'نام سازنده باید حداقل ۲ کاراکتر باشد.' },
          { status: 400 }
        );
      }
      updates.displayName = cleanName;
    }

    if (typeof body?.isActive === 'boolean') {
      updates.isActive = body.isActive;
    }

    if (typeof body?.password === 'string' && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' },
          { status: 400 }
        );
      }
      updates.password = body.password;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'هیچ تغییری برای ثبت ارسال نشده است.' },
        { status: 400 }
      );
    }

    const updated = await updateBuilderAccount(builderId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: 'حساب سازنده یافت نشد.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ builder: updated });
  } catch (error) {
    return handleRouteError(error, 'خطا در ویرایش اطلاعات سازنده.');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ builderId: string }> }
) {
  const { admin, response } = await requireSuperAdmin(request);
  if (response || !admin) return response!;

  try {
    const { builderId: rawId } = await context.params;
    const builderId = parsePositiveIntId(rawId);
    if (!builderId) {
      return NextResponse.json(
        { error: 'شناسهٔ سازنده نامعتبر است.' },
        { status: 400 }
      );
    }

    const ok = await deleteBuilderAccount(builderId);
    if (!ok) {
      return NextResponse.json(
        { error: 'حساب سازنده یافت نشد.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در حذف حساب سازنده.');
  }
}
