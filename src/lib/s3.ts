import crypto from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ExpenseImageAttachment } from '../types/app';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export class S3ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'S3ConfigError';
  }
}

interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

function readS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const endpointRaw = process.env.S3_ENDPOINT?.trim() || undefined;
  let endpoint: string | undefined;
  if (endpointRaw) {
    try {
      const parsed = new URL(endpointRaw);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        endpoint = parsed.toString().replace(/\/$/, '');
      }
    } catch {
      endpoint = undefined;
    }
  }

  const region = process.env.S3_REGION?.trim() || 'us-east-1';
  const forcePathEnv = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  const forcePathStyle =
    forcePathEnv === 'true'
      ? true
      : forcePathEnv === 'false'
        ? false
        : Boolean(endpoint);

  const publicBaseRaw = process.env.S3_PUBLIC_BASE_URL?.trim() || undefined;
  let publicBaseUrl: string | undefined;
  if (publicBaseRaw) {
    try {
      const parsed = new URL(publicBaseRaw);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        publicBaseUrl = parsed.toString().replace(/\/$/, '');
      }
    } catch {
      publicBaseUrl = undefined;
    }
  }

  return {
    bucket,
    region,
    endpoint,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

export function isS3Configured(): boolean {
  return readS3Config() !== null;
}

let cachedClient: S3Client | null = null;
let cachedConfigHash = '';

function getS3Client(): { client: S3Client; config: S3Config } {
  const config = readS3Config();
  if (!config) {
    throw new S3ConfigError(
      'اتصال فضای ذخیره‌سازی S3 پیکربندی نشده است. لطفاً متغیرهای S3_BUCKET، S3_ACCESS_KEY_ID و S3_SECRET_ACCESS_KEY (و در صورت نیاز S3_ENDPOINT و S3_REGION) را در تنظیمات محیط سرور وارد کنید.'
    );
  }

  const hash = `${config.bucket}|${config.region}|${config.endpoint ?? ''}|${config.forcePathStyle}|${config.accessKeyId}`;
  if (!cachedClient || cachedConfigHash !== hash) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedConfigHash = hash;
  }

  return { client: cachedClient, config };
}

/**
 * Inspects leading magic bytes to verify the upload is genuinely a JPEG, PNG, or WebP image.
 */
export function detectImageMimeFromMagicBytes(
  bytes: Uint8Array
): AllowedImageMime | null {
  if (!bytes || bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export function mimeToExtension(mime: AllowedImageMime): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}

export function buildProjectUploadKey(
  projectId: number,
  mime: AllowedImageMime
): string {
  const ext = mimeToExtension(mime);
  return `projects/${projectId}/expenses/${crypto.randomUUID()}.${ext}`;
}

export function isKeyOwnedByProject(projectId: number, key: string): boolean {
  if (!Number.isInteger(projectId) || projectId <= 0) return false;
  if (typeof key !== 'string' || !key) return false;
  if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    return false;
  }
  const prefix = `projects/${projectId}/expenses/`;
  if (!key.startsWith(prefix)) return false;
  const remainder = key.slice(prefix.length);
  return /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(remainder);
}

export function buildProjectImageUrl(
  projectId: number,
  key: string,
  publicBaseUrl?: string
): string {
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${key}`;
  }
  return `/api/projects/${projectId}/uploads?key=${encodeURIComponent(key)}`;
}

export async function uploadProjectImageToS3(params: {
  projectId: number;
  buffer: Buffer;
  detectedMime: AllowedImageMime;
  originalFileName: string;
}): Promise<ExpenseImageAttachment> {
  const { client, config } = getS3Client();
  const key = buildProjectUploadKey(params.projectId, params.detectedMime);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.detectedMime,
      CacheControl: 'private, max-age=31536000',
    })
  );

  const safeName =
    params.originalFileName
      .replace(/[/\\<>:"|?*\u0000-\u001f]/g, '_')
      .trim()
      .slice(0, 140) || `photo.${mimeToExtension(params.detectedMime)}`;

  return {
    key,
    url: buildProjectImageUrl(params.projectId, key, config.publicBaseUrl),
    fileName: safeName,
    contentType: params.detectedMime,
    size: params.buffer.byteLength,
    uploadedAt: new Date().toISOString(),
  };
}

export async function getProjectImageFromS3(
  projectId: number,
  key: string
): Promise<{
  bytes: Uint8Array;
  contentType: string;
} | null> {
  if (!isKeyOwnedByProject(projectId, key)) {
    return null;
  }
  const { client, config } = getS3Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );

  if (!res.Body) return null;
  const bytes = await res.Body.transformToByteArray();
  const contentType =
    typeof res.ContentType === 'string' &&
    (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(res.ContentType)
      ? res.ContentType
      : 'application/octet-stream';

  return { bytes, contentType };
}

export async function deleteProjectImageFromS3(
  projectId: number,
  key: string
): Promise<boolean> {
  if (!isKeyOwnedByProject(projectId, key)) return false;
  if (!isS3Configured()) return false;
  try {
    const { client, config } = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
    return true;
  } catch (err) {
    console.error('S3 delete error (non-fatal):', err);
    return false;
  }
}
