import { db } from "@/lib/db";
import type { Book } from "@/types/knowledge-base";

/**
 * Uploads service — ingestion store (server-only).
 *
 * Uploaded books are persisted in Postgres (BookUpload) with the file in
 * object storage (R2/S3, production) or on local disk (dev fallback).
 * Ready rows are merged into the library catalogue by
 * src/services/books.ts so /api/books, /library and the mobile app fetch
 * them like any KB book.
 *
 * Large-file flow (production): presign → browser PUTs directly to
 * storage → complete. The Next.js server never sees the bytes, so
 * serverless body limits don't apply.
 */

export interface UploadedBookRecord {
  id: string;
  title: string;
  author: string;
  translator: string | null;
  category: string;
  language: string;
  description: string | null;
  publisher: string | null;
  edition: string | null;
  license: string | null;
  series: string | null;
  volumeLabel: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storage: string;
  storagePath: string;
  objectKey: string | null;
  fileUrl: string;
  status: string;
  pageCount: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function tableReady(): Promise<boolean> {
  try {
    // False until `prisma db push` has run (or the DB is unreachable) —
    // every caller degrades gracefully instead of crashing the route.
    await db.bookUpload.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  }
}

export async function listUploads(options?: {
  status?: string;
  series?: string;
  limit?: number;
}): Promise<UploadedBookRecord[]> {
  if (!(await tableReady())) return [];
  return db.bookUpload.findMany({
    where: {
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.series ? { series: options.series } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options?.limit ?? 100, 1), 500),
  });
}

export async function countUploads(): Promise<number> {
  if (!(await tableReady())) return 0;
  return db.bookUpload.count();
}

/** Ready uploads projected onto the public Book contract. */
export async function listReadyBooks(): Promise<Array<Book & UploadedFileMeta>> {
  if (!(await tableReady())) return [];
  const rows = await db.bookUpload.findMany({
    where: { status: "ready" },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map(toBook);
}

export interface UploadedFileMeta {
  fileUrl: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadId: string;
  series?: string;
  volumeLabel?: string;
}

export async function getUploadedBook(
  idOrUploadId: string
): Promise<(Book & UploadedFileMeta) | null> {
  if (!(await tableReady())) return null;
  const uploadId = idOrUploadId.startsWith("upload-")
    ? idOrUploadId.slice("upload-".length)
    : idOrUploadId;
  const row = await db.bookUpload.findUnique({ where: { id: uploadId } });
  if (!row || row.status !== "ready") return null;
  return toBook(row);
}

export function toBook(row: {
  id: string;
  title: string;
  author: string;
  translator: string | null;
  category: string;
  language: string;
  description: string | null;
  publisher: string | null;
  edition: string | null;
  license: string | null;
  series: string | null;
  volumeLabel: string | null;
  fileUrl: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  pageCount: number | null;
  createdAt: Date;
}): Book & UploadedFileMeta {
  const volumeSuffix = row.volumeLabel ? ` — ${row.volumeLabel}` : "";
  return {
    id: `upload-${row.id}`,
    title: `${row.title}${volumeSuffix}`,
    author: row.author,
    translator: row.translator ?? undefined,
    // Stored as plain strings; the BookCard label maps fall back to the
    // raw value for unknown entries so they never crash.
    category: row.category as Book["category"],
    language: row.language as Book["language"],
    description:
      [row.description, row.series ? `Part of the ${row.series} series.` : null]
        .filter(Boolean)
        .join(" ") || undefined,
    publisher: row.publisher ?? undefined,
    edition: row.edition ?? undefined,
    license: row.license ?? undefined,
    pageCount: row.pageCount ?? undefined,
    addedAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString().slice(0, 10)
        : String(row.createdAt).slice(0, 10),
    // Extra fetch metadata for the website/app (ignored by BookCard).
    fileUrl: row.fileUrl,
    originalFilename: row.originalFilename,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    uploadId: row.id,
    series: row.series ?? undefined,
    volumeLabel: row.volumeLabel ?? undefined,
  };
}
