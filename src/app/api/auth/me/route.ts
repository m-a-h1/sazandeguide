import { NextRequest, NextResponse } from 'next/server';
import { getActiveBuilderById } from '../../../../db/buildersRepo';
import { DatabaseConfigError } from '../../../../lib/mongodb';
import { getSessionFromRequest } from '../../../../lib/serverAuth';
import {
  createSessionToken,
  getSessionCookieOptions,
  type SessionUser,
} from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ user: null });
  }

  if (session.role === 'superadmin') {
    const refreshedToken = createSessionToken(session);
    const res = NextResponse.json({ user: session, token: refreshedToken });
    res.cookies.set({
      ...getSessionCookieOptions(request),
      value: refreshedToken,
    });
    return res;
  }

  try {
    const activeBuilder = await getActiveBuilderById(session.userId);
    if (!activeBuilder) {
      const res = NextResponse.json({ user: null });
      res.cookies.set({
        ...getSessionCookieOptions(request, 0),
        value: '',
      });
      return res;
    }

    const refreshedUser: SessionUser = {
      role: 'builder',
      userId: activeBuilder.id,
      username: activeBuilder.username,
      displayName: activeBuilder.displayName,
    };
    const refreshedToken = createSessionToken(refreshedUser);
    const res = NextResponse.json({
      user: refreshedUser,
      token: refreshedToken,
    });
    res.cookies.set({
      ...getSessionCookieOptions(request),
      value: refreshedToken,
    });
    return res;
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return NextResponse.json(
        { user: null, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ user: null });
  }
}
