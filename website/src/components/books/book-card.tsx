"use client";

import Link from "next/link";
import { BookOpen, Download, FileText } from "lucide-react";
import type { Book } from "@/types/knowledge-base";
import type { UploadedFileMeta } from "@/services/uploads";
import { formatBytes } from "@/config/uploads";
import { demoCategoryLabels } from "@/lib/demo/books";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBadge } from "@/components/common/states";
import { StarLattice } from "@/components/decor/islamic-pattern";
import { FavoriteButton } from "@/components/library/favorite-button";

type CardBook = Book & {
  coverHue?: number;
} & Partial<UploadedFileMeta>;

/**
 * Reusable book card — links to the book detail page.
 *
 * Two flavours, rendered honestly:
 *  - real ingested volumes (id `upload-*`, with a fileUrl): series/volume
 *    line, file size, PDF badge and a direct download action.
 *  - labeled demo placeholders: the Demo badge, exactly as before.
 */
export function BookCard({
  book,
  href,
  className,
}: {
  book: CardBook;
  /** Override destination (defaults to the book detail page). */
  href?: string;
  className?: string;
}) {
  const hue = book.coverHue ?? 165;
  const dest = href ?? `/library/${book.id}`;
  const isReal = book.id.startsWith("upload-") || Boolean(book.fileUrl);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        className
      )}
    >
      <CardContent className="flex gap-4 p-4">
        {/* Cover (generated placeholder — real covers come with text processing) */}
        <Link
          href={dest}
          className="focus-ring relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-md sm:w-24"
          aria-label={`Open ${book.title}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <span
            className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.04]"
            style={{
              background: `linear-gradient(145deg, oklch(0.34 0.07 ${hue}), oklch(0.48 0.09 ${hue}))`,
            }}
          />
          <StarLattice
            tile={40}
            className="absolute inset-0 h-full w-full text-white opacity-20"
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-white">
            <BookOpen className="h-4 w-4 opacity-80" aria-hidden="true" />
            <span className="line-clamp-2 text-center font-serif text-[10px] leading-tight opacity-95">
              {demoCategoryLabels[book.category] ?? book.category}
            </span>
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-serif text-sm font-semibold leading-snug sm:text-base">
              <Link
                href={dest}
                className="focus-ring rounded-sm transition-colors hover:text-primary"
              >
                {book.title}
              </Link>
            </h3>
            {book.isDemo ? (
              <DemoBadge className="mt-0.5 shrink-0" />
            ) : isReal ? (
              <span
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary"
                title="Real ingested volume — full PDF available"
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                PDF
              </span>
            ) : null}
          </div>
          <p className="mb-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
            {book.author}
            {book.translator ? ` · tr. ${book.translator}` : ""}
          </p>
          {book.series ? (
            <p className="mb-1 line-clamp-1 text-[11px] font-medium text-gold-foreground dark:text-gold">
              {book.series}
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
              {demoCategoryLabels[book.category] ?? book.category}
            </span>
            <span className="uppercase">{book.language}</span>
            {book.pageCount ? <span>· {book.pageCount} pages</span> : null}
            {typeof book.fileSize === "number" && book.fileSize > 0 ? (
              <span>· {formatBytes(book.fileSize)}</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          {isReal && book.fileUrl ? (
            <a
              href={book.fileUrl}
              download={book.originalFilename ?? true}
              aria-label={`Download ${book.title} (PDF)`}
              title={`Download ${book.title} (PDF)`}
              className="focus-ring rounded-full p-2 text-primary transition-colors hover:bg-primary/10"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
          <FavoriteButton bookId={book.id} bookTitle={book.title} />
        </div>
      </CardContent>
    </Card>
  );
}
