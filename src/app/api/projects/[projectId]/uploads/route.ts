import { NextRequest, NextResponse } from 'next/server';
import { assertBuilderOwnsProject, getOwnedProjectName } from '../../../../../db/projectsRepo';
import {
  deleteProjectImageFromS3,
  detectImageMimeFromMagicBytes,
  getProjectImageUrl,
  isKeyOwnedByProject,
  isS3Configured,
  MAX_UPLOAD_SIZE_BYTES,
  S3ConfigError,
  uploadProjectImageToS3,
} from '../../../../../lib/projectImages';
import {
  handleRouteError,
  parsePositiveIntId,
  requireAuth,
} from '../../../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const rawHost =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  const host = rawHost?.split(',')[0]?.trim();
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

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

    const owns = await assertBuilderOwnsProject(auth.dbUserId, projectId);
    if (!owns) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }

    const url = new URL(request.url);
    if (url.searchParams.get('status') === '1') {
      return NextResponse.json({ configured: isS3Configured() });
    }

    const key = url.searchParams.get('key')?.trim() ?? '';
    if (!key || !isKeyOwnedByProject(projectId, key)) {
      return NextResponse.json(
        { error: 'شناسهٔ تصویر نامعتبر است.' },
        { status: 400 }
      );
    }

    return NextResponse.redirect(await getProjectImageUrl(projectId, key), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof S3ConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return handleRouteError(error, 'خطا در دریافت تصویر از فضای ذخیره‌سازی.');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'درخواست نامعتبر است.' },
      { status: 403 }
    );
  }

  try {
    const { projectId: rawProjectId } = await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    if (!projectId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه نامعتبر است.' },
        { status: 400 }
      );
    }

    const projectName = await getOwnedProjectName(auth.dbUserId, projectId);
    if (!projectName) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }

    if (!isS3Configured()) {
      return NextResponse.json(
        {
          error:
            'فضای ذخیره‌سازی S3 هنوز پیکربندی نشده است. متغیرهای S3_BUCKET_NAME، S3_DOMAIN، S3_ACCESS_KEY و S3_SECRET_ACCESS_KEY را در تنظیمات سرور ثبت کنید.',
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'فایل تصویر ارسال نشده است.' },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: 'فایل انتخاب‌شده خالی است.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'حداکثر حجم مجاز برای هر تصویر ۵ مگابایت است.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const detectedMime = detectImageMimeFromMagicBytes(buffer);
    if (!detectedMime) {
      return NextResponse.json(
        { error: 'فقط تصاویر استاندارد با فرمت JPG، PNG یا WebP مجاز هستند.' },
        { status: 400 }
      );
    }

    const image = await uploadProjectImageToS3({
      projectId,
      builderName: auth.displayName || auth.username,
      projectName,
      buffer,
      detectedMime,
      originalFileName: file.name || 'image',
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    if (error instanceof S3ConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return handleRouteError(error, 'خطا در بارگذاری تصویر در فضای S3.');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'درخواست نامعتبر است.' },
      { status: 403 }
    );
  }

  try {
    const { projectId: rawProjectId } = await context.params;
    const projectId = parsePositiveIntId(rawProjectId);
    if (!projectId) {
      return NextResponse.json(
        { error: 'شناسهٔ پروژه نامعتبر است.' },
        { status: 400 }
      );
    }

    const owns = await assertBuilderOwnsProject(auth.dbUserId, projectId);
    if (!owns) {
      return NextResponse.json({ error: 'پروژه یافت نشد.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    if (!key || !isKeyOwnedByProject(projectId, key)) {
      return NextResponse.json(
        { error: 'شناسهٔ تصویر نامعتبر است.' },
        { status: 400 }
      );
    }

    await deleteProjectImageFromS3(projectId, key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'خطا در حذف تصویر از فضای S3.');
  }
}
