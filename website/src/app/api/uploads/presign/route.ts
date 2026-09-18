import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isS3Configured } from "@/config/storage";
import { objectKeyFor, presignPut } from "@/lib/s3";
import { validateMetadata } from "@/lib/upload-validation";

export const runtime = "nodejs";

/**
 * POST /api/uploads/presign
 * Body (JSON): { filename, mimeType, fileSize, title, author,
 *   translator?, category?, language?, description?, publisher?,
 *   edition?, license?, series?, volumeLabel?, pageCount? }
 *
 * Production path for real books (100s of MB): creates a BookUpload row
 * with status "uploading" and returns a presigned PUT URL. The browser
 * uploads the bytes DIRECTLY to object storage — the serverless function
 * never sees them, so platform body limits don't apply.
 *
 * 503 when object storage is not configured (use multipart POST locally).
 */
export async function POST(request: NextRequest) {
  if (!isS3Configured()) {
    return NextResponse.json(
      {
        error:
          "Direct upload is not configured (missing S3_* environment). Use the multipart POST on a dev server instead.",
      },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 }
    );
  }

  const checked = validateMetadata(body);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }
  const { meta, filename, mimeType } = checked;

  try {
    // Create first so the object key embeds a stable id.
    const pending = await db.bookUpload.create({
      data: {
        ...meta,
        originalFilename: filename,
        mimeType,
        fileSize: 0,
        storage: "r2",
        storagePath: "",
        objectKey: "",
        fileUrl: "",
        status: "uploading",
      },
    });

    const objectKey = objectKeyFor(filename, pending.id, meta.series);
    const url = await presignPut(objectKey, mimeType);
    const item = await db.bookUpload.update({
      where: { id: pending.id },
      data: { objectKey },
    });
    return NextResponse.json(
      { item, uploadUrl: url, method: "PUT" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/uploads/presign] failed:", error);
    return NextResponse.json(
      { error: "Could not prepare the upload. Is the database reachable?" },
      { status: 500 }
    );
  }
}
