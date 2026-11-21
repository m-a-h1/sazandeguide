import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieOptions } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    ...getSessionCookieOptions(request, 0),
    value: '',
  });
  return res;
}
