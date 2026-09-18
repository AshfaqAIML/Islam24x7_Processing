import { isAllowedExtension, uploadConfig } from "@/config/uploads";

/**
 * Shared metadata validation for all ingestion endpoints (multipart POST
 * and the presigned-URL flow). Server-only only by convention — pure
 * functions, no secrets.
 */

export const CATEGORIES = new Set([
  "quran-sciences",
  "tafsir",
  "hadith",
  "fiqh",
  "aqeedah",
  "seerah",
  "history",
  "ethics",
  "family",
  "islamic-studies",
  "dua",
  "other",
]);

export const LANGUAGES = new Set(["ar", "en", "ur", "id", "tr", "bn", "other"]);

export interface BookMetadata {
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
  pageCount: number | null;
}

/** validation error message, or null when the metadata is acceptable. */
export function validateMetadata(input: Record<string, unknown>): {
  ok: true;
  meta: BookMetadata;
  filename: string;
  mimeType: string;
  fileSize: number;
} | { ok: false; error: string } {
  const str = (v: unknown) => String(v ?? "").trim();
  const title = str(input.title);
  const author = str(input.author);
  const translator = str(input.translator) || null;
  const category = str(input.category) || "other";
  const language = str(input.language) || "en";
  const description = str(input.description) || null;
  const publisher = str(input.publisher) || null;
  const edition = str(input.edition) || null;
  const license = str(input.license) || null;
  const series = str(input.series) || null;
  const volumeLabel = str(input.volumeLabel) || null;
  const pageCountRaw = str(input.pageCount);
  const pageCount = pageCountRaw ? Number(pageCountRaw) : null;
  const filename = str(input.filename || input.originalFilename) || "upload.bin";
  const mimeType = str(input.mimeType) || "application/octet-stream";
  const fileSize = Number(input.fileSize ?? 0);

  if (!title) return { ok: false, error: "Title is required." };
  if (!author) return { ok: false, error: "Author is required." };
  if (!CATEGORIES.has(category))
    return { ok: false, error: `Unknown category "${category}".` };
  if (!LANGUAGES.has(language))
    return { ok: false, error: `Unknown language "${language}".` };
  if (pageCount !== null && (!Number.isFinite(pageCount) || pageCount < 0)) {
    return { ok: false, error: "Page count must be a positive number." };
  }
  if (!isAllowedExtension(filename)) {
    return {
      ok: false,
      error: `Unsupported file type. Accepted: ${uploadConfig.allowedExtensions.join(", ")}`,
    };
  }
  if (!(fileSize > 0)) {
    return { ok: false, error: "The file is empty — pick another one." };
  }
  if (fileSize > uploadConfig.maxFileSizeBytes) {
    return {
      ok: false,
      error: `File is too large (max ${Math.round(uploadConfig.maxFileSizeBytes / 1024 / 1024 / 1024)} GB). Split multi-volume sets into one file per volume.`,
    };
  }

  return {
    ok: true,
    meta: {
      title,
      author,
      translator,
      category,
      language,
      description,
      publisher,
      edition,
      license,
      series,
      volumeLabel,
      pageCount,
    },
    filename,
    mimeType,
    fileSize,
  };
}
