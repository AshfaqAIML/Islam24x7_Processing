import { db } from "@/lib/db";
import type { Book } from "@/types/knowledge-base";

/**
 * Uploads service — local ingestion store (server-only).
 *
 * Uploaded books are persisted in SQLite (BookUpload) with the file on
 * disk. They are merged into the library catalogue by src/services/books.ts
 * so /api/books, /library and the mobile app fetch them like any KB book.
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
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  fileUrl: string;
  status: string;
  pageCount: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function tableReady(): Promise<boolean> {
  try {
    // Throws (P2021 table does not exist) until `prisma db push` has run.
    await db.bookUpload.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  }
}

export async function listUploads(options?: {
  status?: string;
  limit?: number;
}): Promise<UploadedBookRecord[]> {
  if (!(await tableReady())) return [];
  return db.bookUpload.findMany({
    where: options?.status ? { status: options.status } : undefined,
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
  fileUrl: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  pageCount: number | null;
  createdAt: Date;
}): Book & UploadedFileMeta {
  return {
    id: `upload-${row.id}`,
    title: row.title,
    author: row.author,
    translator: row.translator ?? undefined,
    // Stored as plain strings; fall back to "other" for unknown values so
    // the BookCard label maps never crash.
    category: row.category as Book["category"],
    language: row.language as Book["language"],
    description: row.description ?? undefined,
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
  };
}
