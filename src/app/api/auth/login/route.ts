import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateBuilder,
  normalizeUsername,
} from '../../../../db/buildersRepo';
import { DatabaseConfigError } from '../../../../lib/mongodb';
import { safeCompareStrings } from '../../../../lib/password';
import {
  createSessionToken,
  getSessionCookieOptions,
  type SessionUser,
} from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawUsername = typeof body?.username === 'string' ? body.username : '';
    const rawPassword = typeof body?.password === 'string' ? body.password : '';
    const portal = body?.portal === 'superadmin' ? 'superadmin' : 'builder';

    const normalizedUsername = normalizeUsername(rawUsername);
    if (!normalizedUsername || !rawPassword) {
      return NextResponse.json(
        { error: 'لطفاً نام کاربری و رمز عبور را وارد کنید.' },
        { status: 400 }
      );
    }

    if (portal === 'superadmin') {
      const adminUsername = process.env.SUPERADMIN_USERNAME?.trim() ?? '';
      const adminPassword = process.env.SUPERADMIN_PASSWORD ?? '';
      const adminConfigured =
        Boolean(adminUsername && adminUsername !== 'MY_SUPERADMIN_USERNAME') &&
        Boolean(adminPassword && adminPassword !== 'MY_SUPERADMIN_PASSWORD');

      if (!adminConfigured) {
        return NextResponse.json(
          {
            error:
              'نام کاربری یا رمز عبور مدیر کل در تنظیمات محیطی سامانه تعریف نشده است.',
          },
          { status: 500 }
        );
      }

      if (
        !safeCompareStrings(normalizedUsername, adminUsername.toLowerCase()) ||
        !safeCompareStrings(rawPassword, adminPassword)
      ) {
        return NextResponse.json(
          { error: 'نام کاربری یا رمز عبور مدیر کل نادرست است.' },
          { status: 401 }
        );
      }

      const sessionUser: SessionUser = {
        role: 'superadmin',
        userId: 0,
        username: adminUsername.toLowerCase(),
        displayName: 'مدیر کل سامانه',
      };

      const token = createSessionToken(sessionUser);
      const res = NextResponse.json({ user: sessionUser, token });
      res.cookies.set({
        ...getSessionCookieOptions(request),
        value: token,
      });
      return res;
    }

    const authResult = await authenticateBuilder(
      normalizedUsername,
      rawPassword
    );
    if (!authResult.builder) {
      if (authResult.reason === 'disabled') {
        return NextResponse.json(
          { error: 'حساب کاربری شما غیرفعال شده است. با مدیر کل تماس بگیرید.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'نام کاربری یا رمز عبور نادرست است.' },
        { status: 401 }
      );
    }

    const sessionUser: SessionUser = {
      role: 'builder',
      userId: authResult.builder.id,
      username: authResult.builder.username,
      displayName: authResult.builder.displayName,
    };

    const token = createSessionToken(sessionUser);
    const res = NextResponse.json({ user: sessionUser, token });
    res.cookies.set({
      ...getSessionCookieOptions(request),
      value: token,
    });
    return res;
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'ورود به سامانه با خطا مواجه شد. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    );
  }
}
