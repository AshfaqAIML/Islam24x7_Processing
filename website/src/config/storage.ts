/**
 * Object-storage (S3-compatible, e.g. Cloudflare R2) configuration.
 *
 * Server-only: read exclusively from API routes / server code, never
 * imported by client components (it only carries public-safe derived
 * values except through the /api/uploads/config probe, which exposes
 * provider + limits but never secrets).
 */

export interface S3Settings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public base URL files are served from, e.g. https://books.example.com */
  publicBaseUrl: string;
}

export function s3Settings(): S3Settings | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim()?.replace(/\/+$/, "");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null;
  }
  return {
    endpoint,
    region: process.env.S3_REGION?.trim() || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

/** True when direct-to-R2 uploads are available (production path). */
export function isS3Configured(): boolean {
  return s3Settings() !== null;
}

/** "r2" when object storage is configured, otherwise "local" dev disk. */
export function storageProvider(): "r2" | "local" {
  return isS3Configured() ? "r2" : "local";
}
