import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, safeCompareStrings, verifyPassword } from './password.ts';
import {
  createSessionToken,
  extractBearerToken,
  getSessionCookieOptions,
  isHttpsRequest,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from './session.ts';

test('scrypt password hashing verifies valid passwords and rejects wrong passwords', async () => {
  const hash1 = await hashPassword('secret123');
  const hash2 = await hashPassword('secret123');

  assert.notEqual(hash1, hash2, 'Each hash uses a unique random salt');
  assert.equal(await verifyPassword('secret123', hash1), true);
  assert.equal(await verifyPassword('wrongpass', hash1), false);
  assert.equal(await verifyPassword('secret123', 'malformed'), false);
});

test('safeCompareStrings handles equal and different lengths safely', () => {
  assert.equal(safeCompareStrings('admin', 'admin'), true);
  assert.equal(safeCompareStrings('admin', 'admi'), false);
  assert.equal(safeCompareStrings('admin', 'admin123'), false);
});

test('HMAC session token uses 30-day TTL, verifies, and rejects tampered tokens', () => {
  assert.equal(SESSION_TTL_SECONDS, 60 * 60 * 24 * 30);

  const before = Math.floor(Date.now() / 1000);
  const token = createSessionToken({
    role: 'builder',
    userId: 42,
    username: 'ali_builder',
    displayName: 'علی سازنده',
  });

  const [payloadPart, sigPart] = token.split('.');
  const decodedPayload = JSON.parse(
    Buffer.from(payloadPart, 'base64url').toString('utf8')
  ) as { exp: number };

  assert.ok(
    decodedPayload.exp >= before + SESSION_TTL_SECONDS - 2 &&
      decodedPayload.exp <= before + SESSION_TTL_SECONDS + 5,
    'Token expiration must be 30 days ahead'
  );

  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.role, 'builder');
  assert.equal(verified.userId, 42);
  assert.equal(verified.username, 'ali_builder');

  const tamperedPayload = Buffer.from(
    JSON.stringify({
      role: 'superadmin',
      userId: 0,
      username: 'hacker',
      displayName: 'hack',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    'utf8'
  ).toString('base64url');

  assert.equal(verifySessionToken(`${tamperedPayload}.${sigPart}`), null);
  assert.equal(verifySessionToken(`${payloadPart}.invalidsig`), null);
});

test('extractBearerToken extracts bearer tokens case-insensitively', () => {
  assert.equal(extractBearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(extractBearerToken('bearer   token_123  '), 'token_123');
  assert.equal(extractBearerToken('Basic abc'), null);
  assert.equal(extractBearerToken('Bearer   '), null);
  assert.equal(extractBearerToken(null), null);
});

test('getSessionCookieOptions sets Secure, SameSite=None, and Partitioned for HTTPS proxies', () => {
  const makeReq = (headers: Record<string, string>, protocol = 'http:') =>
    ({
      headers: new Headers(headers),
      nextUrl: { protocol },
    }) as unknown as Parameters<typeof getSessionCookieOptions>[0];

  const proxiedHttps = getSessionCookieOptions(
    makeReq({ 'x-forwarded-proto': 'https, http' })
  );
  assert.equal(proxiedHttps.secure, true);
  assert.equal(proxiedHttps.sameSite, 'none');
  assert.equal(proxiedHttps.partitioned, true);
  assert.equal(proxiedHttps.httpOnly, true);

  const originHttps = getSessionCookieOptions(
    makeReq({ origin: 'https://example.run.app' })
  );
  assert.equal(originHttps.secure, true);
  assert.equal(originHttps.sameSite, 'none');
  assert.equal(originHttps.partitioned, true);

  const localHttp = getSessionCookieOptions(makeReq({}));
  assert.equal(isHttpsRequest(makeReq({})), false);
  assert.equal(localHttp.secure, false);
  assert.equal(localHttp.sameSite, 'lax');
  assert.equal(localHttp.partitioned, false);
});
