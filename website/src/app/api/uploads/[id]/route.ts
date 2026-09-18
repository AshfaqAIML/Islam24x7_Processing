import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/s3";

/**
 * GET /api/uploads/:id — one ingested book (operator detail / download link).
 * DELETE /api/uploads/:id — remove the DB row and the stored file, so the
 * book disappears from /api/books, /library and the app on the next fetch.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const row = await db.bookUpload.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item: row });
  } catch (error) {
    console.error("[api/uploads/:id] fetch failed:", error);
    return NextResponse.json(
      { error: "Upload store is unavailable." },
      { status: 503 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const row = await db.bookUpload.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await db.bookUpload.delete({ where: { id } });
    // Best effort file cleanup — the catalogue record is already gone, so
    // a missing file must never fail the request.
    if (row.storage === "r2" && row.objectKey) {
      await deleteObject(row.objectKey);
    } else if (row.storagePath) {
      try {
        await unlink(row.storagePath);
      } catch {
        /* file already removed — ignore */
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/uploads/:id] delete failed:", error);
    return NextResponse.json(
      { error: "Could not delete the book." },
      { status: 500 }
    );
  }
}
