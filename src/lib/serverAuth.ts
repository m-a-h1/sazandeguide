import { NextRequest, NextResponse } from 'next/server';
import { getActiveBuilderById } from '../db/buildersRepo';
import { DatabaseConfigError } from './mongodb';
import {
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
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function requireAuth(
  request: NextRequest
): Promise<RequireAuthResult> {
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
