import { NextRequest, NextResponse } from 'next/server';
import { getActiveBuilderById } from '../db/buildersRepo';
import { DatabaseConfigError } from './mongodb';
import {
  extractBearerToken,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionUser,
} from './session';

export interface VerifiedAuthContext {
  role: 'builder';
  username: string;
  displayName: string;
  dbUserId: number;
}

export interface RequireAuthResult {
  auth: VerifiedAuthContext | null;
  response: NextResponse | null;
}

export interface RequireSuperAdminResult {
  admin: SessionUser | null;
  response: NextResponse | null;
}

export function getSessionFromRequest(request: NextRequest): SessionUser | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const bearer = extractBearerToken(authHeader);
    return verifySessionToken(bearer);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

function isSameOriginCookieMutation(request: NextRequest): boolean {
  if (
    request.method === 'GET' ||
    request.method === 'HEAD' ||
    request.method === 'OPTIONS'
  ) {
    return true;
  }
  if (extractBearerToken(request.headers.get('authorization'))) {
    return true;
  }
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const rawHost =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  const host = rawHost?.split(',')[0]?.trim().toLowerCase();
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export async function requireAuth(
  request: NextRequest
): Promise<RequireAuthResult> {
  if (!isSameOriginCookieMutation(request)) {
    return {
      auth: null,
      response: NextResponse.json(
        { error: 'درخواست نامعتبر است.' },
        { status: 403 }
      ),
    };
  }

  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      auth: null,
      response: NextResponse.json(
        { error: 'احراز هویت انجام نشده است. لطفاً ابتدا وارد حساب کاربری شوید.' },
        { status: 401 }
      ),
    };
  }

  if (session.role !== 'builder') {
    return {
      auth: null,
      response: NextResponse.json(
        { error: 'این بخش فقط مخصوص حساب‌های سازندگان است.' },
        { status: 401 }
      ),
    };
  }

  try {
    const activeBuilder = await getActiveBuilderById(session.userId);
    if (!activeBuilder) {
      return {
        auth: null,
        response: NextResponse.json(
          { error: 'حساب سازنده غیرفعال شده یا در دسترس نیست.' },
          { status: 401 }
        ),
      };
    }

    return {
      auth: {
        role: 'builder',
        username: activeBuilder.username,
        displayName: activeBuilder.displayName,
        dbUserId: activeBuilder.id,
      },
      response: null,
    };
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return {
        auth: null,
        response: NextResponse.json({ error: error.message }, { status: 500 }),
      };
    }
    const message =
      error instanceof Error ? error.message : 'خطا در اتصال به پایگاه داده.';
    return {
      auth: null,
      response: NextResponse.json({ error: message }, { status: 500 }),
    };
  }
}

export async function requireSuperAdmin(
  request: NextRequest
): Promise<RequireSuperAdminResult> {
  if (!isSameOriginCookieMutation(request)) {
    return {
      admin: null,
      response: NextResponse.json(
        { error: 'درخواست نامعتبر است.' },
        { status: 403 }
      ),
    };
  }

  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      admin: null,
      response: NextResponse.json(
        { error: 'احراز هویت انجام نشده است. لطفاً ابتدا وارد شوید.' },
        { status: 401 }
      ),
    };
  }

  if (session.role !== 'superadmin') {
    return {
      admin: null,
      response: NextResponse.json(
        { error: 'دسترسی غیرمجاز؛ این عملیات فقط برای مدیر کل مجاز است.' },
        { status: 401 }
      ),
    };
  }

  return { admin: session, response: null };
}

export async function requireAnySession(
  request: NextRequest
): Promise<{ session: SessionUser | null; response: NextResponse | null }> {
  if (!isSameOriginCookieMutation(request)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: 'درخواست نامعتبر است.' },
        { status: 403 }
      ),
    };
  }

  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: 'احراز هویت انجام نشده است.' },
        { status: 401 }
      ),
    };
  }
  return { session, response: null };
}

export function handleRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof DatabaseConfigError) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}

export function parsePositiveIntId(raw: string): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}
