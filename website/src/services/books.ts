/**
 * Books service — the ONLY place that knows where book data comes from.
 *
 *  - live: proxies the Knowledge Base backend (KNOWLEDGE_BASE_API_URL)
 *  - demo: serves clearly-labeled placeholder records (src/lib/demo)
 *
 * API routes and server components import from here; the client browser
 * only ever calls our own /api/* routes. Adapt the remote paths to the
 * real contract when the backend lands — nothing else changes.
 */
import type {
  Book,
  BookChapter,
  BookCategory,
  BookLanguage,
  BookPage,
  Paginated,
} from "@/types/knowledge-base";
import { demoBooks, demoChaptersFor } from "@/lib/demo/books";
import { demoPagesFor } from "@/lib/demo/pages";
import { kbDataSource, kbFetch } from "@/services/kb";
import { getUploadedBook, listReadyBooks } from "@/services/uploads";

export type BookSort = "recent" | "title" | "pages";

export interface ListBooksParams {
  q?: string;
  category?: BookCategory | "all";
  language?: BookLanguage | "all";
  sort?: BookSort;
  page?: number;
  pageSize?: number;
}

export interface BooksPage extends Paginated<Book> {
  /** Where the data came from — the UI surfaces this honestly. */
  source: "live" | "demo";
}

const DEFAULT_PAGE_SIZE = 9;

/* --------------------------------- demo ---------------------------------- */

function listBooksDemo(params: ListBooksParams): BooksPage {
  const q = params.q?.trim().toLowerCase() ?? "";
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  let items: Book[] = [...demoBooks];

  if (params.category && params.category !== "all") {
    items = items.filter((b) => b.category === params.category);
  }
  if (params.language && params.language !== "all") {
    items = items.filter((b) => b.language === params.language);
  }
  if (q) {
    items = items.filter((b) =>
      [b.title, b.author, b.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  switch (params.sort ?? "recent") {
    case "title":
      items.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "pages":
      items.sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0));
      break;
    default:
      items.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
  }

  const total = items.length;
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
    source: "demo",
  };
}

/* --------------------------------- live ---------------------------------- */

function listBooksLive(params: ListBooksParams): Promise<BooksPage> {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category && params.category !== "all") sp.set("category", params.category);
  if (params.language && params.language !== "all") sp.set("language", params.language);
  if (params.sort) sp.set("sort", params.sort);
  sp.set("page", String(Math.max(1, params.page ?? 1)));
  sp.set("pageSize", String(params.pageSize ?? DEFAULT_PAGE_SIZE));

  return kbFetch<Paginated<Book>>(`/books?${sp.toString()}`).then((res) => ({
    ...res,
    source: "live" as const,
  }));
}

function getBookLive(id: string): Promise<Book | null> {
  return kbFetch<Book | null>(`/books/${encodeURIComponent(id)}`).catch(() => null);
}

function getBookChaptersLive(bookId: string): Promise<BookChapter[]> {
  return kbFetch<BookChapter[]>(
    `/books/${encodeURIComponent(bookId)}/chapters`
  ).catch(() => []);
}

function getBookPagesLive(
  bookId: string,
  chapterId?: string
): Promise<BookPage[]> {
  const sp = new URLSearchParams();
  if (chapterId) sp.set("chapterId", chapterId);
  return kbFetch<BookPage[]>(
    `/books/${encodeURIComponent(bookId)}/pages?${sp.toString()}`
  ).catch(() => []);
}

/* -------------------------------- public --------------------------------- */

/**
 * Local uploads are merged in front of demo/live results so anything
 * ingested via /admin/upload is immediately fetchable from /api/books,
 * /library and the mobile app. Filters (q/category/language) and sorting
 * apply to uploaded rows exactly like catalogue books.
 */
function applyFilters(
  items: Book[],
  params: ListBooksParams
): Book[] {
  const q = params.q?.trim().toLowerCase() ?? "";
  let out = [...items];
  if (params.category && params.category !== "all") {
    out = out.filter((b) => b.category === params.category);
  }
  if (params.language && params.language !== "all") {
    out = out.filter((b) => b.language === params.language);
  }
  if (q) {
    out = out.filter((b) =>
      [b.title, b.author, b.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  switch (params.sort ?? "recent") {
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "pages":
      out.sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0));
      break;
    default:
      out.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
  }
  return out;
}

export async function listBooks(params: ListBooksParams = {}): Promise<BooksPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  // Uploaded books first — never let a broken local store break the library.
  let uploaded: Book[] = [];
  try {
    uploaded = applyFilters(await listReadyBooks(), params);
  } catch {
    uploaded = [];
  }

  let base: BooksPage;
  if (kbDataSource() === "live") {
    try {
      base = await listBooksLive(params);
    } catch {
      base = { ...listBooksDemo(params), source: "demo" };
    }
  } else {
    base = listBooksDemo(params);
  }

  // When paginating, uploads occupy the head of page 1; later pages fall
  // through to the base catalogue. Total counts both sources honestly.
  if (page === 1) {
    const head = uploaded.slice(0, pageSize);
    const remaining = pageSize - head.length;
    const items = remaining > 0 ? [...head, ...base.items.slice(0, remaining)] : head;
    return {
      items,
      total: uploaded.length + base.total,
      page,
      pageSize,
      hasMore: uploaded.length + base.total > items.length,
      source: uploaded.length > 0 ? "live" : base.source,
    };
  }

  // Page > 1: uploads already occupied the head of page 1, so later
  // pages fall through to the base catalogue (total still counts both).
  return base.total + uploaded.length > 0
    ? { ...base, total: base.total + uploaded.length }
    : base;
}

export async function getBook(id: string): Promise<(Book & { coverHue?: number }) | null> {
  if (id.startsWith("upload-")) {
    try {
      return await getUploadedBook(id);
    } catch {
      return null;
    }
  }
  if (kbDataSource() === "live") {
    const live = await getBookLive(id);
    if (live) return live;
  }
  const demo = demoBooks.find((b) => b.id === id);
  return demo ?? null;
}

export async function getBookChapters(bookId: string): Promise<BookChapter[]> {
  // Uploaded files have no extracted TOC yet — the reader falls back to a
  // download-first view using the book's fileUrl.
  if (bookId.startsWith("upload-")) return [];
  if (kbDataSource() === "live") {
    const live = await getBookChaptersLive(bookId);
    if (live.length > 0) return live;
  }
  return demoChaptersFor(bookId);
}

export interface BookPagesResult {
  pages: BookPage[];
  chapterId: string | null;
  chapterTitle: string | null;
  source: "live" | "demo";
}

export async function getBookPages(
  bookId: string,
  chapterId?: string
): Promise<BookPagesResult> {
  if (kbDataSource() === "live") {
    const live = await getBookPagesLive(bookId, chapterId);
    if (live.length > 0) {
      return {
        pages: live,
        chapterId: chapterId ?? live[0]?.chapterId ?? null,
        chapterTitle: null,
        source: "live",
      };
    }
  }
  const pages = demoPagesFor(bookId, chapterId);
  return {
    pages,
    chapterId: pages[0]?.chapterId ?? null,
    chapterTitle: null,
    source: "demo",
  };
}
