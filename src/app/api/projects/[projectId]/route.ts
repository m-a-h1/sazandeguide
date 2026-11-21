import { NextRequest, NextResponse } from 'next/server';
import {
  deleteProjectForUser,
  sanitizeRateRecord,
  updateProjectForUser,
} from '../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../lib/serverAuth';
import { parseJalaliDate } from '../../../../utils/jalali';

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
    const updates: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: 'نام پروژه نمی‌تواند خالی باشد.' },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }
    if (typeof body.address === 'string') updates.address = body.address.trim();
    if (typeof body.description === 'string') {
      updates.description = body.description.trim();
    }
    if (body.areaSqm !== undefined) {
      if (
        body.areaSqm !== null &&
        (typeof body.areaSqm !== 'number' ||
          !Number.isFinite(body.areaSqm) ||
          body.areaSqm <= 0)
      ) {
        return NextResponse.json(
          { error: 'متراژ زیربنای کل باید عددی مثبت باشد.' },
          { status: 400 }
        );
      }
      updates.areaSqm =
        typeof body.areaSqm === 'number' && body.areaSqm > 0
          ? body.areaSqm
          : null;
    }
    if (body.usefulAreaSqm !== undefined) {
      if (
        body.usefulAreaSqm !== null &&
        (typeof body.usefulAreaSqm !== 'number' ||
          !Number.isFinite(body.usefulAreaSqm) ||
          body.usefulAreaSqm <= 0)
      ) {
        return NextResponse.json(
          { error: 'متراژ زیربنای مفید باید عددی مثبت باشد.' },
          { status: 400 }
        );
      }
      updates.usefulAreaSqm =
        typeof body.usefulAreaSqm === 'number' && body.usefulAreaSqm > 0
          ? body.usefulAreaSqm
          : null;
    }
    if (body.floors !== undefined) {
      updates.floors =
        typeof body.floors === 'number' && body.floors >= 0
          ? Math.trunc(body.floors)
          : null;
    }
    if (body.units !== undefined) {
      updates.units =
        typeof body.units === 'number' && body.units >= 0
          ? Math.trunc(body.units)
          : null;
    }
    if (typeof body.startDateJalali === 'string') {
      if (body.startDateJalali.trim()) {
        const check = parseJalaliDate(body.startDateJalali);
        if (!check.valid) {
          return NextResponse.json(
            { error: `تاریخ شروع نامعتبر است: ${check.error}` },
            { status: 400 }
          );
        }
        updates.startDateJalali = check.normalized;
      } else {
        updates.startDateJalali = '';
      }
    }
    if (typeof body.endDateJalali === 'string') {
      if (body.endDateJalali.trim()) {
        const check = parseJalaliDate(body.endDateJalali);
        if (!check.valid) {
          return NextResponse.json(
            { error: `تاریخ پایان نامعتبر است: ${check.error}` },
            { status: 400 }
          );
        }
        updates.endDateJalali = check.normalized;
      } else {
        updates.endDateJalali = '';
      }
    }
    if (
      body.status === 'در حال ساخت' ||
      body.status === 'تکمیل‌شده' ||
      body.status === 'متوقف‌شده'
    ) {
      updates.status = body.status;
    }
    if (
      body.currency === 'تومان' ||
      body.currency === 'ریال' ||
      body.currency === 'تعیین‌نشده'
    ) {
      updates.currency = body.currency;
    }
    if (body.taxPercent !== undefined) {
      if (
        typeof body.taxPercent !== 'number' ||
        !Number.isFinite(body.taxPercent) ||
        body.taxPercent < 0 ||
        body.taxPercent > 100
      ) {
        return NextResponse.json(
          { error: 'درصد مالیات باید عددی بین ۰ تا ۱۰۰ باشد.' },
          { status: 400 }
        );
      }
      updates.taxPercent = body.taxPercent;
    }
    if (body.landPrice !== undefined) {
      if (
        body.landPrice !== null &&
        (typeof body.landPrice !== 'number' ||
          !Number.isFinite(body.landPrice) ||
          body.landPrice < 0)
      ) {
        return NextResponse.json(
          { error: 'قیمت زمین نمی‌تواند منفی یا نامعتبر باشد.' },
          { status: 400 }
        );
      }
      updates.landPrice =
        typeof body.landPrice === 'number' ? body.landPrice : 0;
    }
    if (body.partnershipPercent !== undefined) {
      if (
        body.partnershipPercent !== null &&
        (typeof body.partnershipPercent !== 'number' ||
          !Number.isFinite(body.partnershipPercent) ||
          body.partnershipPercent <= 0 ||
          body.partnershipPercent > 100)
      ) {
        return NextResponse.json(
          { error: 'درصد مشارکت باید عددی بزرگ‌تر از ۰ و حداکثر ۱۰۰ باشد.' },
          { status: 400 }
        );
      }
      updates.partnershipPercent =
        typeof body.partnershipPercent === 'number'
          ? body.partnershipPercent
          : null;
    }
    if (
      body.draftCategoryRates &&
      typeof body.draftCategoryRates === 'object' &&
      !Array.isArray(body.draftCategoryRates)
    ) {
      updates.draftCategoryRates = sanitizeRateRecord(body.draftCategoryRates);
    }

    const updated = await updateProjectForUser(
      auth.dbUserId,
      projectId,
      updates
    );
    if (!updated) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'خطا در ویرایش پروژه.');
  }
}

export async function DELETE(
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

    const deleted = await deleteProjectForUser(
      auth.dbUserId,
      projectId
    );
    if (!deleted) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در حذف پروژه.');
  }
}
