import { NextRequest, NextResponse } from 'next/server';
import {
  createBuilderAccount,
  listBuildersWithProjectCounts,
  normalizeUsername,
} from '../../../../db/buildersRepo';
import {
  handleRouteError,
  requireSuperAdmin,
} from '../../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { admin, response } = await requireSuperAdmin(request);
  if (response || !admin) return response!;

  try {
    const builders = await listBuildersWithProjectCounts();
    return NextResponse.json({ builders });
  } catch (error) {
    return handleRouteError(error, 'خطا در دریافت فهرست سازندگان.');
  }
}

export async function POST(request: NextRequest) {
  const { admin, response } = await requireSuperAdmin(request);
  if (response || !admin) return response!;

  try {
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
    const rawUsername =
      typeof body?.username === 'string' ? body.username.trim() : '';
    const rawPassword =
      typeof body?.password === 'string' ? body.password : '';

    if (!rawName || rawName.length < 2) {
      return NextResponse.json(
        { error: 'نام سازنده باید حداقل ۲ کاراکتر باشد.' },
        { status: 400 }
      );
    }

    const cleanUsername = normalizeUsername(rawUsername);
    if (!cleanUsername || cleanUsername.length < 3 || /\s/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'نام کاربری باید حداقل ۳ کاراکتر و بدون فاصله باشد.' },
        { status: 400 }
      );
    }

    const superAdminUsername =
      process.env.SUPERADMIN_USERNAME?.trim().toLowerCase() ?? '';
    if (superAdminUsername && cleanUsername === superAdminUsername) {
      return NextResponse.json(
        { error: 'این نام کاربری متعلق به مدیر کل است و قابل استفاده نیست.' },
        { status: 400 }
      );
    }

    if (!rawPassword || rawPassword.length < 6) {
      return NextResponse.json(
        { error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' },
        { status: 400 }
      );
    }

    const builder = await createBuilderAccount({
      displayName: rawName,
      username: cleanUsername,
      password: rawPassword,
    });

    return NextResponse.json({ builder }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('نام کاربری')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleRouteError(error, 'خطا در ایجاد حساب سازنده.');
  }
}
