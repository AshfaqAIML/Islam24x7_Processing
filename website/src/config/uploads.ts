/**
 * Upload console configuration — single source of truth for the book
 * ingestion frontend (/admin/upload) and the /api/uploads routes.
 *
 * Files are stored on local disk (public/uploads/books in dev) so they are
 * immediately fetchable by the website/app via fileUrl. Swap
 * UPLOAD_DIR / file serving for object storage (S3/R2) in production
 * without touching the UI.
 */

export const uploadConfig = {
  /**
   * Max single file size (bytes). 1 GB fits comfortably in a Prisma Int
   * (~2.1 GB cap) and covers ~1000-page scanned volumes; raise only
   * together with the column type. Serverless platforms also cap request
   * bodies (~4.5 MB on Vercel), so large files always upload DIRECTLY to
   * object storage via presigned URLs — never through the Next.js API.
   */
  maxFileSizeBytes: 1 * 1024 * 1024 * 1024, // 1 GB
  /** Accepted extensions (lowercase, with dot). */
  allowedExtensions: [".pdf", ".docx", ".epub", ".txt", ".md"] as const,
  /** Accepted MIME types (browsers report these inconsistently, so the
   *  extension check is authoritative). */
  allowedMimeTypes: [
    "application/pdf",
    "application/epub+zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
    "application/octet-stream",
  ] as const,
  /** Public URL prefix under which stored files are served. */
  publicPrefix: "/uploads/books",
} as const;

export type AllowedExtension =
  (typeof uploadConfig.allowedExtensions)[number];

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function isAllowedExtension(filename: string): boolean {
  return (uploadConfig.allowedExtensions as readonly string[]).includes(
    extensionOf(filename)
  );
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
