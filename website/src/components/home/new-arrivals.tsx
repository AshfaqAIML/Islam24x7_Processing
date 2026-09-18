import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { listBooks } from "@/services/books";
import { BookCard } from "@/components/books/book-card";
import { routes } from "@/config/site";

/**
 * "New in the library" shelf — showcases the most recently ingested real
 * volumes (Tibyan-ul-Quran, Kanzul Iman, the Hadith collections…).
 * Renders nothing until at least one real (non-demo) book exists, so the
 * home page never promises what isn't there.
 */
export async function NewArrivals() {
  let items: Awaited<ReturnType<typeof listBooks>>["items"] = [];
  try {
    const page = await listBooks({ sort: "recent", page: 1, pageSize: 6 });
    items = page.items.filter((b) => !b.isDemo);
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="new-arrivals-heading"
      className="mx-auto max-w-6xl px-4 py-10 sm:py-12"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2
          id="new-arrivals-heading"
          className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight sm:text-2xl"
        >
          <Sparkles
            className="h-5 w-5 text-gold-foreground dark:text-gold"
            aria-hidden="true"
          />
          New in the library
        </h2>
        <Link
          href={routes.library}
          className="focus-ring inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((book) => (
          <li key={book.id}>
            <BookCard book={book} className="h-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}
