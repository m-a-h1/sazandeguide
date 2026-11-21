import { NextRequest, NextResponse } from 'next/server';
import {
  createPricingVersionForProject,
  sanitizeRateRecord,
} from '../../../../../db/projectsRepo';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../lib/serverAuth';
import { parseJalaliDate } from '../../../../../utils/jalali';

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
    const dateRaw =
      typeof body?.versionDateJalali === 'string' ? body.versionDateJalali : '';
    const dateCheck = parseJalaliDate(dateRaw);

    if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
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

    const created = await createPricingVersionForProject(
      auth.dbUserId,
      projectId,
      {
        name: body.name.trim(),
        versionDateJalali: dateCheck.normalized!,
        description:
          typeof body.description === 'string' ? body.description.trim() : '',
        baseReferenceType:
          body.baseReferenceType === 'VERSION' ? 'VERSION' : 'BASE',
        parentVersionId:
          typeof body.parentVersionId === 'number' &&
          Number.isInteger(body.parentVersionId)
            ? body.parentVersionId
            : null,
        parentVersionName:
          typeof body.parentVersionName === 'string'
            ? body.parentVersionName
            : null,
        categoryRatesSnapshot: sanitizeRateRecord(body.categoryRatesSnapshot),
        taxPercentSnapshot:
          typeof body.taxPercentSnapshot === 'number' &&
          Number.isFinite(body.taxPercentSnapshot) &&
          body.taxPercentSnapshot >= 0
            ? body.taxPercentSnapshot
            : 0,
        landPriceSnapshot:
          typeof body.landPriceSnapshot === 'number' &&
          Number.isFinite(body.landPriceSnapshot) &&
          body.landPriceSnapshot >= 0
            ? body.landPriceSnapshot
            : 0,
        partnershipPercentSnapshot:
          typeof body.partnershipPercentSnapshot === 'number' &&
          Number.isFinite(body.partnershipPercentSnapshot) &&
          body.partnershipPercentSnapshot > 0 &&
          body.partnershipPercentSnapshot <= 100
            ? body.partnershipPercentSnapshot
            : null,
        totalBaseAmount: Number(body.totalBaseAmount) || 0,
        totalReferenceAmount: Number(body.totalReferenceAmount) || 0,
        totalEstimatedAmount: Number(body.totalEstimatedAmount) || 0,
        diffFromBaseAmount: Number(body.diffFromBaseAmount) || 0,
        diffFromBasePercent: Number(body.diffFromBasePercent) || 0,
        itemsSnapshot: Array.isArray(body.itemsSnapshot)
          ? body.itemsSnapshot
          : [],
      }
    );

    if (!created) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'خطا در ذخیره نسخه.');
  }
}
