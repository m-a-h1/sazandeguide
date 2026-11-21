import crypto from 'crypto';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'saas_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionRole = 'superadmin' | 'builder';

export interface SessionUser {
  role: SessionRole;
  userId: number;
  username: string;
  displayName: string;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

declare global {
  var __saasSessionSecret: string | undefined;
}

function getSessionSecret(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit && explicit !== 'MY_SESSION_SECRET') {
    return explicit;
  }
  if (!globalThis.__saasSessionSecret) {
    const envSeed = [
      process.env.SUPERADMIN_PASSWORD,
      process.env.MONGODB_URI,
    ]
      .filter((v) => Boolean(v && v.trim()))
      .join('|');
    globalThis.__saasSessionSecret = envSeed
      ? crypto
          .createHash('sha256')
          .update(`saas-session-key:${envSeed}`)
          .digest('hex')
      : crypto.randomBytes(32).toString('hex');
  }
  return globalThis.__saasSessionSecret;
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const sig = signPayload(encoded);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null
): SessionUser | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = signPayload(encoded);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !parsed ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    if (parsed.role !== 'superadmin' && parsed.role !== 'builder') {
      return null;
    }

    if (
      typeof parsed.username !== 'string' ||
      typeof parsed.displayName !== 'string' ||
      typeof parsed.userId !== 'number'
    ) {
      return null;
    }

    return {
      role: parsed.role,
      userId: parsed.userId,
      username: parsed.username,
      displayName: parsed.displayName,
    };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(request: NextRequest, maxAge?: number) {
  const proto =
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(':', '');
  const isHttps = proto === 'https';

  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
    maxAge: maxAge ?? SESSION_TTL_SECONDS,
  };
}
