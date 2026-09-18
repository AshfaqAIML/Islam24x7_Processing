import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadConfig } from "@/config/uploads";
import { deleteObject, headObject, publicUrlFor } from "@/lib/s3";

export const runtime = "nodejs";

/**
 * POST /api/uploads/:id/complete
 * Called by the browser AFTER its direct PUT to object storage finishes.
 * Verifies the object exists, records its real size, and flips the row to
 * "ready" so the book is immediately fetchable from /api/books, /library
 * and the mobile app.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const row = await db.bookUpload.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (row.status === "ready") return NextResponse.json({ item: row });
    if (row.storage !== "r2" || !row.objectKey) {
      return NextResponse.json(
        { error: "This upload did not use direct storage upload." },
        { status: 400 }
      );
    }

    let head;
    try {
      head = await headObject(row.objectKey);
    } catch {
      return NextResponse.json(
        {
          error:
            "The file has not arrived in storage yet. Finish the upload in your browser and retry.",
        },
        { status: 422 }
      );
    }
    if (!(head.size > 0)) {
      return NextResponse.json(
        { error: "The stored file is empty." },
        { status: 422 }
      );
    }
    if (head.size > uploadConfig.maxFileSizeBytes) {
      await deleteObject(row.objectKey);
      await db.bookUpload.update({
        where: { id },
        data: { status: "failed", error: "File exceeds the size limit." },
      });
      return NextResponse.json(
        { error: "File exceeds the size limit and was removed." },
        { status: 413 }
      );
    }

    const item = await db.bookUpload.update({
      where: { id },
      data: {
        status: "ready",
        fileSize: head.size,
        mimeType: head.mimeType ?? row.mimeType,
        fileUrl: publicUrlFor(row.objectKey),
        error: null,
      },
    });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[api/uploads/:id/complete] failed:", error);
    return NextResponse.json(
      { error: "Could not finalize the upload." },
      { status: 500 }
    );
  }
}
