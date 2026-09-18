import path from "node:path";
import { extensionOf } from "@/config/uploads";

/**
 * Upload storage helpers (server-only).
 *
 * Local-disk strategy: files live under <root>/public/uploads/books so
 * Next.js serves them statically at /uploads/books/<name>, which is exactly
 * the fileUrl persisted on BookUpload and consumed by the website/app.
 */

export function uploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads", "books");
}

function sanitizeBase(name: string): string {
  const base = path.basename(name, path.extname(name));
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return cleaned || "book";
}

/** Unique, filesystem-safe filename preserving the original extension. */
export function uniqueFilename(
  originalFilename: string,
  id: string
): string {
  const ext = extensionOf(originalFilename) || ".bin";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${stamp}-${sanitizeBase(originalFilename)}-${id}${ext}`;
}
