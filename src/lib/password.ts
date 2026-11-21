import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (keyBuf.length !== KEY_LENGTH) return false;
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return crypto.timingSafeEqual(keyBuf, derived);
}

export function safeCompareStrings(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
