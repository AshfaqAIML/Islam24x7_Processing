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
  series: string | null;
  volumeLabel: string | null;
  storage: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  status: string;
  pageCount: number | null;
  createdAt: string;
}

interface ServerConfig {
  provider: "r2" | "local";
  maxFileSizeBytes: number;
  accept: string[];
}

const ACCEPT = ".pdf,.docx,.epub,.txt,.md";

function fileError(file: File, maxBytes: number): string | null {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : "";
  if (
    !(uploadConfig.allowedExtensions as readonly string[]).includes(ext)
  ) {
    return `Unsupported file type "${ext || "unknown"}". Accepted: ${uploadConfig.allowedExtensions.join(", ")}`;
  }
  if (file.size <= 0) return "That file looks empty — pick another one.";
  if (file.size > maxBytes) {
    return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(maxBytes)} — split multi-volume sets one file per volume.`;
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
  const [series, setSeries] = useState("");
  const [volumeLabel, setVolumeLabel] = useState("");
  const [pageCount, setPageCount] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  // Server capability probe: "r2" = direct-to-storage for real books,
  // "local" = dev-disk fallback. Falls back to local limits offline.
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    provider: "local",
    maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    accept: [...uploadConfig.allowedExtensions],
  });

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
    // Capability probe (never blocks the form if it fails).
    fetch("/api/uploads/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && (json.provider === "r2" || json.provider === "local")) {
          setServerConfig({
            provider: json.provider,
            maxFileSizeBytes:
              Number(json.maxFileSizeBytes) > 0
                ? Number(json.maxFileSizeBytes)
                : uploadConfig.maxFileSizeBytes,
            accept: Array.isArray(json.accept) ? json.accept : [...uploadConfig.allowedExtensions],
          });
        }
      })
      .catch(() => {});
  }, [fetchList]);

  const pickFile = useCallback(
    (next: File | null) => {
      setNotice(null);
      setFormError(null);
      if (!next) {
        setFile(null);
        return;
      }
      const err = fileError(next, serverConfig.maxFileSizeBytes);
      if (err) {
        setFormError(err);
        return;
      }
      setFile(next);
      setTitle((t) => t || titleFromFilename(next.name));
    },
    [serverConfig.maxFileSizeBytes]
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

  function resetForm() {
    setFile(null);
    setTitle("");
    setAuthor("");
    setTranslator("");
    setDescription("");
    setPublisher("");
    setEdition("");
    setLicense("");
    setSeries("");
    setVolumeLabel("");
    setPageCount("");
    setCategory("other");
    setLanguage("en");
    setUploadProgress(0);
    setUploadStage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function metadataPayload() {
    return {
      title: title.trim(),
      author: author.trim(),
      translator: translator.trim() || undefined,
      category,
      language,
      description: description.trim() || undefined,
      publisher: publisher.trim() || undefined,
      edition: edition.trim() || undefined,
      license: license.trim() || undefined,
      series: series.trim() || undefined,
      volumeLabel: volumeLabel.trim() || undefined,
      pageCount: pageCount.trim() || undefined,
    };
  }

  /** PUT a large file straight to object storage with real progress. */
  function putDirect(url: string, f: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(
              new Error(`Storage upload failed (HTTP ${xhr.status}). Retry the upload.`)
            );
      xhr.onerror = () =>
        reject(new Error("Storage upload failed (network error). Retry the upload."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.send(f);
    });
  }

  /** Production path: presign → direct PUT → complete. */
  async function submitDirect(f: File) {
    setUploadStage("Preparing upload…");
    setUploadProgress(2);
    const pre = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...metadataPayload(),
        filename: f.name,
        mimeType: f.type || "application/octet-stream",
        fileSize: f.size,
      }),
    });
    const preJson = await pre.json().catch(() => ({}));
    if (!pre.ok) throw new Error(preJson.error ?? "Could not start the upload.");

    setUploadStage(`Uploading ${formatBytes(f.size)}…`);
    await putDirect(preJson.uploadUrl, f);

    setUploadStage("Finalizing…");
    setUploadProgress(100);
    const done = await fetch(
      `/api/uploads/${encodeURIComponent(preJson.item.id)}/complete`,
      { method: "POST" }
    );
    const doneJson = await done.json().catch(() => ({}));
    if (!done.ok) throw new Error(doneJson.error ?? "Could not finalize the upload.");
    return doneJson.item;
  }

  /** Dev fallback: multipart POST through the Next.js server. */
  async function submitLocal(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    const meta = metadataPayload();
    for (const [k, v] of Object.entries(meta)) {
      if (v !== undefined) fd.set(k, String(v));
    }
    setUploadStage("Uploading…");
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Upload failed.");
    return json.item;
  }

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
    const sizeErr = fileError(file, serverConfig.maxFileSizeBytes);
    if (sizeErr) {
      setFormError(sizeErr);
      return;
    }
    setFormError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const item =
        serverConfig.provider === "r2"
          ? await submitDirect(file)
          : await submitLocal(file);
      setNotice({
        kind: "ok",
        text: `“${item.title}” is stored and now live in the library for the website/app.`,
      });
      resetForm();
      await fetchList();
    } catch (err) {
      setNotice({
        kind: "err",
        text: err instanceof Error ? err.message : "Upload failed.",
      });
      setUploadStage(null);
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
            {formatBytes(serverConfig.maxFileSizeBytes)} per file.{" "}
            {serverConfig.provider === "r2" ? (
              <>
                Files stream <strong>directly to cloud storage</strong> with
                resume-safe progress — built for ~1000-page volumes.
              </>
            ) : (
              <>
                Dev-disk mode: files are stored on this server. Configure
                object storage (S3_* env) for production-sized books.
              </>
            )}
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

            {uploading ? (
              <div className="flex flex-col gap-1.5" aria-live="polite">
                <Progress value={uploadProgress} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {uploadStage ?? "Uploading…"}
                  {serverConfig.provider === "r2" && uploadProgress > 0
                    ? ` ${uploadProgress}%`
                    : ""}
                  {" — keep this tab open."}
                </p>
              </div>
            ) : null}

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
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="up-series">Series / collection</Label>
                <Input
                  id="up-series"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  placeholder="e.g. Fatawa Rizvia — same name groups all volumes"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="up-volume">Volume label</Label>
                <Input
                  id="up-volume"
                  value={volumeLabel}
                  onChange={(e) => setVolumeLabel(e.target.value)}
                  placeholder="e.g. Volume 7"
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
                  placeholder="e.g. 1000"
                />
              </div>
            </div>

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {uploadStage ?? "Uploading…"}
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  Upload &amp; publish to library
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Multi-volume work? Upload <strong>one file per volume</strong>{" "}
              with the same series name and a volume label — all 32 volumes
              stay grouped and individually fetchable. Only upload books you
              have the right to share.
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
                    <p className="truncate text-sm font-semibold">
                      {row.title}
                      {row.volumeLabel ? ` — ${row.volumeLabel}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.author} · {row.originalFilename} ·{" "}
                      {row.fileSize > 0 ? formatBytes(row.fileSize) : "size pending"}
                      {row.series ? ` · ${row.series}` : ""}
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
                      <Badge
                        variant={row.status === "ready" ? "outline" : "destructive"}
                        className="text-[10px]"
                      >
                        {row.status === "uploading" ? "upload in progress" : row.status}
                      </Badge>
                      {row.storage === "r2" ? (
                        <Badge variant="outline" className="text-[10px]">
                          cloud
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {row.fileUrl ? (
                      <Button asChild variant="ghost" size="icon" aria-label={`Download ${row.title}`}>
                        <a href={row.fileUrl} download={row.originalFilename}>
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </a>
                      </Button>
                    ) : null}
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
