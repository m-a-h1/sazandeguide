import { removeFileFromS3, signKey, uploadFileToS3 } from './s3';
import type { ExpenseImageAttachment } from '../types/app';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export class S3ConfigError extends Error {}

export function isS3Configured(): boolean {
  return Boolean(process.env.S3_BUCKET_NAME?.trim() && process.env.S3_DOMAIN?.trim() &&
    process.env.S3_ACCESS_KEY?.trim() && process.env.S3_SECRET_ACCESS_KEY?.trim());
}

export function detectImageMimeFromMagicBytes(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return 'image/png';
  if ([0x52, 0x49, 0x46, 0x46].every((byte, index) => bytes[index] === byte) &&
      [0x57, 0x45, 0x42, 0x50].every((byte, index) => bytes[index + 8] === byte)) return 'image/webp';
  return null;
}

export function isKeyOwnedByProject(projectId: number, key: string): boolean {
  if (!Number.isInteger(projectId) || projectId <= 0 || typeof key !== 'string') return false;
  const prefix = `projects/${projectId}/expenses/`;
  const normalized = key.startsWith('dev/') ? key.slice(4) : key;
  if (normalized.startsWith(prefix)) {
    return /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(normalized.slice(prefix.length));
  }
  const parts = normalized.split('/');
  return parts.length === 6 && parts[0] === 'builders' && parts[2] === 'projects' &&
    parts[4] === 'expenses' && [parts[1], parts[3]].every((part) =>
      Boolean(part) && part !== '.' && part !== '..' && !part.includes('\\')) &&
    new RegExp(`^${projectId}-[0-9]+-[a-f0-9-]+\\.(jpg|jpeg|png|webp)$`).test(parts[5]);
}

export function buildProjectImagePath(builderName: string, projectName: string): string {
  const segment = (name: string) => {
    const clean = name.trim().replace(/[/\\\u0000-\u001f\u007f]/g, '_').slice(0, 100);
    return !clean || clean === '.' || clean === '..' ? '_' : clean;
  };
  return `builders/${segment(builderName)}/projects/${segment(projectName)}/expenses`;
}

export async function uploadProjectImageToS3(params: {
  projectId: number; builderName: string; projectName: string; buffer: Buffer; detectedMime: AllowedImageMime; originalFileName: string;
}): Promise<ExpenseImageAttachment> {
  if (!isS3Configured()) throw new S3ConfigError('S3 is not configured.');
  const result = await uploadFileToS3(params.buffer, buildProjectImagePath(params.builderName, params.projectName), params.detectedMime, `${params.projectId}-`);
  return {
    key: result.path,
    url: `/api/projects/${params.projectId}/uploads?key=${encodeURIComponent(result.path)}`,
    fileName: params.originalFileName.replace(/[/\\<>:"|?*\u0000-\u001f]/g, '_').trim().slice(0, 140) || 'image',
    contentType: params.detectedMime,
    size: result.size,
    uploadedAt: new Date().toISOString(),
  };
}

export async function getProjectImageUrl(projectId: number, key: string): Promise<string> {
  if (!isKeyOwnedByProject(projectId, key)) throw new Error('Invalid image key');
  if (!isS3Configured()) throw new S3ConfigError('S3 is not configured.');
  return signKey(key);
}

export async function deleteProjectImageFromS3(projectId: number, key: string): Promise<void> {
  if (!isKeyOwnedByProject(projectId, key)) throw new Error('Invalid image key');
  if (!isS3Configured()) throw new S3ConfigError('S3 is not configured.');
  await removeFileFromS3(key);
}
