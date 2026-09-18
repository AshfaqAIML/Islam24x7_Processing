import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import {
  isAllowedExtension,
  uploadConfig,
} from "@/config/uploads";
import { isS3Configured } from "@/config/storage";
import { uniqueFilename, uploadsDir } from "@/lib/upload-storage";

export const runtime = "nodejs";
// Allow large book files through this route (Next.js default is small).
export const maxDuration = 60;

const CATEGORIES = new Set([
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

const LANGUAGES = new Set(["ar", "en", "ur", "id", "tr", "bn", "other"]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * GET /api/uploads?status=&series=&limit=
 * Lists ingested books (newest first). Powers the admin console table and
 * any operator tooling around the processing pipeline.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") ?? undefined;
    const series = sp.get("series") ?? undefined;
    const limit = Math.min(
      Math.max(Number(sp.get("limit") ?? "100") || 100, 1),
      500
    );
    const rows = await db.bookUpload.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(series ? { series } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ items: rows, total: rows.length });
  } catch (error) {
    console.error("[api/uploads] list failed:", error);
    return NextResponse.json(
      {
        error:
          "Upload store is not ready yet. Run `bunx prisma db push` once, then retry.",
      },
      { status: 503 }
    );
  }
}

/**
 * POST /api/uploads (multipart/form-data) — DEV FALLBACK ONLY.
 * Fields: file (required), title (required), author (required),
 * translator?, category?, language?, description?, publisher?, edition?,
 * license?, series?, volumeLabel?, pageCount?
 *
 * Stores the file under public/uploads/books and creates a ready
 * BookUpload row so the book is immediately fetchable from /api/books,
 * /library and the mobile app.
 *
 * Real books (100s of MB, e.g. multi-volume sets) must use
 * POST /api/uploads/presign instead: serverless platforms cap request
 * bodies (~4.5 MB on Vercel), so large files upload directly to object
 * storage and never pass through this route.
 */
export async function POST(request: NextRequest) {
  if (isS3Configured()) {
    return NextResponse.json(
      {
        error:
          "Direct upload is required on this server. Use POST /api/uploads/presign so the file goes straight to object storage.",
      },
      { status: 413 }
    );
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Expected a multipart/form-data body with a file.");
  }

  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const author = String(form.get("author") ?? "").trim();
  const translator = String(form.get("translator") ?? "").trim() || null;
  const category = String(form.get("category") ?? "other").trim() || "other";
  const language = String(form.get("language") ?? "en").trim() || "en";
  const description = String(form.get("description") ?? "").trim() || null;
  const publisher = String(form.get("publisher") ?? "").trim() || null;
  const edition = String(form.get("edition") ?? "").trim() || null;
  const license = String(form.get("license") ?? "").trim() || null;
  const series = String(form.get("series") ?? "").trim() || null;
  const volumeLabel = String(form.get("volumeLabel") ?? "").trim() || null;
  const pageCountRaw = String(form.get("pageCount") ?? "").trim();
  const pageCount = pageCountRaw ? Number(pageCountRaw) : null;

  if (!(file instanceof File)) return badRequest("Attach a book file first.");
  if (!title) return badRequest("Title is required.");
  if (!author) return badRequest("Author is required.");
  if (!CATEGORIES.has(category))
    return badRequest(`Unknown category "${category}".`);
  if (!LANGUAGES.has(language))
    return badRequest(`Unknown language "${language}".`);
  if (pageCount !== null && (!Number.isFinite(pageCount) || pageCount < 0)) {
    return badRequest("Page count must be a positive number.");
  }

  const originalFilename = file.name || "upload.bin";
  if (!isAllowedExtension(originalFilename)) {
    return badRequest(
      `Unsupported file type. Accepted: ${uploadConfig.allowedExtensions.join(", ")}`
    );
  }
  if (file.size <= 0) return badRequest("The uploaded file is empty.");
  if (file.size > uploadConfig.maxFileSizeBytes) {
    return badRequest(
      `File is too large (max ${Math.round(uploadConfig.maxFileSizeBytes / 1024 / 1024)} MB).`
    );
  }

  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  const filename = uniqueFilename(originalFilename, id);
  const dir = uploadsDir();

  try {
    await mkdir(dir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), bytes);

    const fileUrl = `${uploadConfig.publicPrefix}/${filename}`;
    const row = await db.bookUpload.create({
      data: {
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
        originalFilename,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        storage: "local",
        storagePath: path.join(dir, filename),
        fileUrl,
        status: "ready",
        pageCount,
      },
    });
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (error) {
    console.error("[api/uploads] store failed:", error);
    return NextResponse.json(
      {
        error:
          "Could not store the book. If this is a fresh clone, run `bunx prisma db push` once, then retry.",
      },
      { status: 500 }
    );
  }
}
