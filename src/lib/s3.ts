import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const bucketName = process.env.S3_BUCKET_NAME!;
const s3Domain = process.env.S3_DOMAIN!;
const domain = `https://${s3Domain}`;
const baseUrl = `${domain}/${bucketName}`;

const signedUrlTTL = Number(process.env.SIGNED_URL_TTL_S || 3600);

const s3 = new S3Client({
  region: "default",
  endpoint: domain,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

/**
 * Get file extension from MIME type
 * @param mimetype Image MIME type
 */
function getFileExtension(mimetype: string): string {
  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionMap[mimetype];
  if (!extension) throw new Error("Unsupported image MIME type");
  return extension;
}

export interface S3UploadResponse {
  path: string; // S3 key (path only, no domain)
  url: string; // Full URL including domain
  size: number; // File size in bytes
}

/**
 * Upload file to S3 with organized path structure
 * @param fileBuffer Buffer containing file data
 * @param s3Path Organized image path
 * @param mimetype Image MIME type
 * @returns S3 upload response with path, URL, and size
 */
export const uploadFileToS3 = async (fileBuffer: Buffer, s3Path: string, mimetype: string = "image/webp", filenamePrefix = ""): Promise<S3UploadResponse> => {
  const extension = getFileExtension(mimetype);
  const timestamp = `${filenamePrefix}${new Date().getTime()}-${randomUUID()}`;
  const key = process.env.NODE_ENV === "development" ? `dev/${s3Path}/${timestamp}.${extension}` : `${s3Path}/${timestamp}.${extension}`;

  const params = {
    Bucket: bucketName,
    Body: fileBuffer,
    Key: key,
    ContentType: mimetype,
  };

  await s3.send(new PutObjectCommand(params));

  return {
    path: key,
    url: `${baseUrl}/${key}`,
    size: fileBuffer.length,
  };
};

export const removeFileFromS3 = (filePath: string) =>
  s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: filePath,
    }),
  );

export const removeManyFilesFromS3 = async (filePaths: string[]) => {
  const promises = filePaths.map((path) => removeFileFromS3(path));
  await Promise.all(promises);
};

// sign key

export async function signKey(key: string, expiresIn = signedUrlTTL): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Signs multiple keys in parallel with a concurrency limit.
 * Avoids hammering S3 with hundreds of simultaneous requests.
 */
export async function signKeys(
  keys: (string | undefined | null)[],
  expiresIn = signedUrlTTL,
  concurrency = 20,
): Promise<(string | undefined)[]> {
  const results: (string | undefined)[] = new Array(keys.length).fill(undefined);

  // Process in chunks of `concurrency`
  for (let i = 0; i < keys.length; i += concurrency) {
    const chunk = keys.slice(i, i + concurrency);
    const signed = await Promise.all(chunk.map((key) => (key ? signKey(key, expiresIn) : Promise.resolve(undefined))));
    signed.forEach((url, j) => {
      results[i + j] = url;
    });
  }

  return results;
}
