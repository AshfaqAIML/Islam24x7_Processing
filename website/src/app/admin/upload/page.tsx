import type { Metadata } from "next";
import Link from "next/link";
import { Library, ShieldCheck } from "lucide-react";
import { UploadConsole } from "@/components/admin/upload-console";
import { StarLattice } from "@/components/decor/islamic-pattern";

export const metadata: Metadata = {
  title: "Upload books",
  description:
    "Operator console — upload PDF, DOCX, EPUB, TXT or Markdown books. Stored on this server and fetched by the Islam24X7 website/app library.",
};

export default function AdminUploadPage() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent"
        />
        <StarLattice
          tile={64}
          className="absolute inset-0 h-full w-full text-gold opacity-[0.06]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-foreground/80 dark:text-gold/90">
            Operator console
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Upload books to the library
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Drop a PDF, DOCX, EPUB, TXT or Markdown file with its catalogue
            details. It is stored on this server and immediately fetchable
            from{" "}
            <Link
              href="/library"
              className="font-medium text-gold-foreground underline-offset-2 hover:underline dark:text-gold"
            >
              <Library className="mr-1 inline h-4 w-4" aria-hidden="true" />
              the library
            </Link>{" "}
            and the mobile app via <code>/api/books</code>.
          </p>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Only upload books you own or have permission to share. Each upload
            records its source filename, size and licence for the processing
            pipeline.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <UploadConsole />
      </div>
    </main>
  );
}
