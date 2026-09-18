"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Files,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { demoCategoryLabels, demoLanguageLabels } from "@/lib/demo/books";
import { formatBytes, uploadConfig } from "@/config/uploads";
import type { BookCategory, BookLanguage } from "@/types/knowledge-base";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState } from "@/components/common/states";

interface UploadRow {
  id: string;
  title: string;
  author: string;
  category: string;
  language: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  status: string;
  pageCount: number | null;
  createdAt: string;
}

const ACCEPT = ".pdf,.docx,.epub,.txt,.md";

function fileError(file: File): string | null {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : "";
  if (
    !(uploadConfig.allowedExtensions as readonly string[]).includes(ext)
  ) {
    return `Unsupported file type "${ext || "unknown"}". Accepted: ${uploadConfig.allowedExtensions.join(", ")}`;
  }
  if (file.size <= 0) return "That file looks empty — pick another one.";
  if (file.size > uploadConfig.maxFileSizeBytes) {
    return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(uploadConfig.maxFileSizeBytes)}.`;
  }
  return null;
}

function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

export function UploadConsole() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [translator, setTranslator] = useState("");
  const [category, setCategory] = useState<BookCategory>("other");
  const [language, setLanguage] = useState<BookLanguage>("en");
  const [description, setDescription] = useState("");
  const [publisher, setPublisher] = useState("");
  const [edition, setEdition] = useState("");
  const [license, setLicense] = useState("");
  const [pageCount, setPageCount] = useState("");

  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const [rows, setRows] = useState<UploadRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/uploads?limit=100", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load uploads.");
      setRows(json.items ?? []);
    } catch (e) {
      setListError(
        e instanceof Error ? e.message : "Could not load uploads."
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const pickFile = useCallback(
    (next: File | null) => {
      setNotice(null);
      setFormError(null);
      if (!next) {
        setFile(null);
        return;
      }
      const err = fileError(next);
      if (err) {
        setFormError(err);
        return;
      }
      setFile(next);
      setTitle((t) => t || titleFromFilename(next.name));
    },
    []
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const next = e.dataTransfer.files?.[0] ?? null;
      pickFile(next);
    },
    [pickFile]
  );

  const canSubmit =
    file !== null && title.trim() !== "" && author.trim() !== "" && !uploading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!file) {
      setFormError("Attach a book file first (PDF, DOCX, EPUB, TXT or MD).");
      return;
    }
    if (!title.trim() || !author.trim()) {
      setFormError("Title and author are required.");
      return;
    }
    setFormError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", title.trim());
      fd.set("author", author.trim());
      if (translator.trim()) fd.set("translator", translator.trim());
      fd.set("category", category);
      fd.set("language", language);
      if (description.trim()) fd.set("description", description.trim());
      if (publisher.trim()) fd.set("publisher", publisher.trim());
      if (edition.trim()) fd.set("edition", edition.trim());
      if (license.trim()) fd.set("license", license.trim());
      if (pageCount.trim()) fd.set("pageCount", pageCount.trim());

      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");

      setNotice({
        kind: "ok",
        text: `“${json.item.title}” is stored and now live in the library for the website/app.`,
      });
      setFile(null);
      setTitle("");
      setAuthor("");
      setTranslator("");
      setDescription("");
      setPublisher("");
      setEdition("");
      setLicense("");
      setPageCount("");
      setCategory("other");
      setLanguage("en");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchList();
    } catch (err) {
      setNotice({
        kind: "err",
        text: err instanceof Error ? err.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? It will disappear from the library.`))
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/uploads/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setNotice({ kind: "ok", text: `“${name}” was deleted.` });
    } catch (err) {
      setNotice({
        kind: "err",
        text: err instanceof Error ? err.message : "Delete failed.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <FileUp className="h-5 w-5 text-primary" aria-hidden="true" />
            Upload a book
          </CardTitle>
          <CardDescription>
            PDF, DOCX, EPUB, TXT or Markdown up to{" "}
            {formatBytes(uploadConfig.maxFileSizeBytes)}. Stored on this
            server and served to the Islam24X7 website/app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {/* Dropzone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Attach a book file"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "focus-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              <UploadCloud
                className="h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
              {file ? (
                <div className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={(e) => {
                      e.stopPropagation();
                      pickFile(null);
                      if (fileInputRef.current)
                        fileInputRef.current.value = "";
                    }}
                    className="focus-ring rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag &amp; drop your book here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ACCEPT.replaceAll(".", "").toUpperCase().split(",").join(" · ")}
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {formError ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            ) : null}

            {notice ? (
              <p
                role={notice.kind === "err" ? "alert" : "status"}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                  notice.kind === "ok"
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                )}
              >
                {notice.kind === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                {notice.text}
              </p>
            ) : null}

            {uploading ? <Progress value={60} className="h-1.5" /> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="up-title">Title *</Label>
                <Input
                  id="up-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. The Sealed Nectar"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-author">Author *</Label>
                <Input
                  id="up-author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. Safiur Rahman Mubarakpuri"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-translator">Translator</Label>
                <Input
                  id="up-translator"
                  value={translator}
                  onChange={(e) => setTranslator(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as BookCategory)}
                >
                  <SelectTrigger id="up-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(demoCategoryLabels) as BookCategory[]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {demoCategoryLabels[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-language">Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as BookLanguage)}
                >
                  <SelectTrigger id="up-language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(demoLanguageLabels) as BookLanguage[]
                    ).map((l) => (
                      <SelectItem key={l} value={l}>
                        {demoLanguageLabels[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="up-description">Description</Label>
                <Textarea
                  id="up-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short blurb shown on the book card…"
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-publisher">Publisher</Label>
                <Input
                  id="up-publisher"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-edition">Edition</Label>
                <Input
                  id="up-edition"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-license">License / rights</Label>
                <Input
                  id="up-license"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="e.g. Public domain, with permission"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-pages">Pages</Label>
                <Input
                  id="up-pages"
                  inputMode="numeric"
                  value={pageCount}
                  onChange={(e) =>
                    setPageCount(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Uploading…
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  Upload &amp; publish to library
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Upload only books you have the right to share. Files are stored
              on this server and become readable in the library immediately.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Stored books */}
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Files className="h-5 w-5 text-primary" aria-hidden="true" />
              Stored books
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchList}
              disabled={listLoading}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", listLoading && "animate-spin")}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
          <CardDescription>
            {rows.length === 0
              ? "Nothing stored yet."
              : `${rows.length} ${rows.length === 1 ? "book" : "books"} stored · fetched by /api/books, /library and the app.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading stored books…
            </div>
          ) : listError ? (
            <ErrorState
              title="Upload store unreachable"
              description={listError}
              onRetry={fetchList}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Files}
              title="No books stored yet"
              description="Upload your first PDF, DOCX or EPUB on the left — it appears here and in the library right away."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.author} · {row.originalFilename} ·{" "}
                      {formatBytes(row.fileSize)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {demoCategoryLabels[
                          row.category as BookCategory
                        ] ?? row.category}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {row.language}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {row.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button asChild variant="ghost" size="icon" aria-label={`Download ${row.title}`}>
                      <a href={row.fileUrl} download={row.originalFilename}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${row.title}`}
                      disabled={deletingId === row.id}
                      onClick={() => onDelete(row.id, row.title)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
