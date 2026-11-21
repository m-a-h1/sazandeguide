import { NextRequest, NextResponse } from 'next/server';
import { createProjectForUser } from '../../../db/projectsRepo';
import { handleRouteError, requireAuth } from '../../../lib/serverAuth';
import { parseJalaliDate } from '../../../utils/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      name,
      address,
      description,
      areaSqm,
      usefulAreaSqm,
      floors,
      units,
      startDateJalali,
      endDateJalali,
      status,
      currency,
      taxPercent,
      landPrice,
      partnershipPercent,
    } = body ?? {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'نام پروژه الزامی است.' },
        { status: 400 }
      );
    }
    if (
      areaSqm !== undefined &&
      areaSqm !== null &&
      (typeof areaSqm !== 'number' || !Number.isFinite(areaSqm) || areaSqm <= 0)
    ) {
      return NextResponse.json(
        { error: 'متراژ زیربنای کل باید عددی مثبت باشد.' },
        { status: 400 }
      );
    }
    if (
      usefulAreaSqm !== undefined &&
      usefulAreaSqm !== null &&
      (typeof usefulAreaSqm !== 'number' ||
        !Number.isFinite(usefulAreaSqm) ||
        usefulAreaSqm <= 0)
    ) {
      return NextResponse.json(
        { error: 'متراژ زیربنای مفید باید عددی مثبت باشد.' },
        { status: 400 }
      );
    }
    if (
      taxPercent !== undefined &&
      (typeof taxPercent !== 'number' ||
        !Number.isFinite(taxPercent) ||
        taxPercent < 0 ||
        taxPercent > 100)
    ) {
      return NextResponse.json(
        { error: 'درصد مالیات باید عددی بین ۰ تا ۱۰۰ باشد.' },
        { status: 400 }
      );
    }
    if (
      landPrice !== undefined &&
      landPrice !== null &&
      (typeof landPrice !== 'number' ||
        !Number.isFinite(landPrice) ||
        landPrice < 0)
    ) {
      return NextResponse.json(
        { error: 'قیمت زمین نمی‌تواند منفی یا نامعتبر باشد.' },
        { status: 400 }
      );
    }
    if (
      partnershipPercent !== undefined &&
      partnershipPercent !== null &&
      (typeof partnershipPercent !== 'number' ||
        !Number.isFinite(partnershipPercent) ||
        partnershipPercent <= 0 ||
        partnershipPercent > 100)
    ) {
      return NextResponse.json(
        { error: 'درصد مشارکت باید عددی بزرگ‌تر از ۰ و حداکثر ۱۰۰ باشد.' },
        { status: 400 }
      );
    }
    if (typeof startDateJalali === 'string' && startDateJalali.trim()) {
      const check = parseJalaliDate(startDateJalali);
      if (!check.valid) {
        return NextResponse.json(
          { error: `تاریخ شروع نامعتبر است: ${check.error}` },
          { status: 400 }
        );
      }
    }
    if (typeof endDateJalali === 'string' && endDateJalali.trim()) {
      const check = parseJalaliDate(endDateJalali);
      if (!check.valid) {
        return NextResponse.json(
          { error: `تاریخ پایان نامعتبر است: ${check.error}` },
          { status: 400 }
        );
      }
    }

    const result = await createProjectForUser(auth.dbUserId, {
      name: name.trim(),
      address: typeof address === 'string' ? address.trim() : '',
      description: typeof description === 'string' ? description.trim() : '',
      areaSqm: typeof areaSqm === 'number' && areaSqm > 0 ? areaSqm : null,
      usefulAreaSqm:
        typeof usefulAreaSqm === 'number' && usefulAreaSqm > 0
          ? usefulAreaSqm
          : null,
      floors:
        typeof floors === 'number' && Number.isInteger(floors) && floors >= 0
          ? floors
          : null,
      units:
        typeof units === 'number' && Number.isInteger(units) && units >= 0
          ? units
          : null,
      startDateJalali:
        typeof startDateJalali === 'string' ? startDateJalali.trim() : '',
      endDateJalali:
        typeof endDateJalali === 'string' ? endDateJalali.trim() : '',
      status:
        status === 'تکمیل‌شده' || status === 'متوقف‌شده'
          ? status
          : 'در حال ساخت',
      currency:
        currency === 'ریال' || currency === 'تعیین‌نشده' ? currency : 'تومان',
      taxPercent: typeof taxPercent === 'number' ? taxPercent : 0,
      landPrice: typeof landPrice === 'number' ? landPrice : 0,
      partnershipPercent:
        typeof partnershipPercent === 'number' ? partnershipPercent : null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'خطا در ایجاد پروژه.');
  }
}
