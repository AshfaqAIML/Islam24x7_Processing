import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { extensionOf } from "@/config/uploads";
import { s3Settings } from "@/config/storage";

/**
 * S3-compatible object storage helpers (server-only). Works against
 * Cloudflare R2, AWS S3, or any S3-compatible store.
 */

const PRESIGN_TTL_SECONDS = 15 * 60; // 15 min — enough for GB-scale PUTs to start

let cachedClient: S3Client | null = null;

export function s3Client(): S3Client {
  const s = s3Settings();
  if (!s) throw new Error("Object storage is not configured.");
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: s.region,
      endpoint: s.endpoint,
      credentials: {
        accessKeyId: s.accessKeyId,
        secretAccessKey: s.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

function sanitizeBase(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "book";
}

/** Deterministic-ish object key: books/<series?>/<date>-<slug>-<id><ext> */
export function objectKeyFor(
  originalFilename: string,
  id: string,
  series?: string | null
): string {
  const ext = extensionOf(originalFilename) || ".bin";
  const stamp = new Date().toISOString().slice(0, 10);
  const seriesSlug = series
    ? sanitizeBase(series).slice(0, 40) + "/"
    : "";
  return `books/${seriesSlug}${stamp}-${sanitizeBase(originalFilename)}-${id}${ext}`;
}

export function publicUrlFor(objectKey: string): string {
  const s = s3Settings();
  if (!s) throw new Error("Object storage is not configured.");
  return `${s.publicBaseUrl}/${objectKey}`;
}

/** Presigned PUT URL the browser uses to upload directly to storage. */
export async function presignPut(
  objectKey: string,
  mimeType: string
): Promise<string> {
  const s = s3Settings();
  if (!s) throw new Error("Object storage is not configured.");
  return getSignedUrl(
    s3Client(),
    new PutObjectCommand({
      Bucket: s.bucket,
      Key: objectKey,
      ContentType: mimeType || "application/octet-stream",
    }),
    { expiresIn: PRESIGN_TTL_SECONDS }
  );
}

export interface StoredObjectHead {
  size: number;
  mimeType: string | null;
}

/** Verifies the browser actually finished uploading (throws if missing). */
export async function headObject(objectKey: string): Promise<StoredObjectHead> {
  const s = s3Settings();
  if (!s) throw new Error("Object storage is not configured.");
  const res = await s3Client().send(
    new HeadObjectCommand({ Bucket: s.bucket, Key: objectKey })
  );
  return {
    size: Number(res.ContentLength ?? 0),
    mimeType: res.ContentType ?? null,
  };
}

/** Best-effort delete — a missing object is not an error. */
export async function deleteObject(objectKey: string): Promise<void> {
  const s = s3Settings();
  if (!s) return;
  try {
    await s3Client().send(
      new DeleteObjectCommand({ Bucket: s.bucket, Key: objectKey })
    );
  } catch {
    /* already gone or transient — the DB row is the source of truth */
  }
}
