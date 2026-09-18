import { NextResponse } from "next/server";
import { uploadConfig } from "@/config/uploads";
import { storageProvider } from "@/config/storage";

/**
 * GET /api/uploads/config
 * Public capability probe for the upload console: which storage path the
 * server supports ("r2" direct-to-storage for real books, "local" dev
 * disk), the max file size, and accepted extensions. No secrets exposed.
 */
export async function GET() {
  return NextResponse.json({
    provider: storageProvider(),
    maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    accept: uploadConfig.allowedExtensions,
  });
}
