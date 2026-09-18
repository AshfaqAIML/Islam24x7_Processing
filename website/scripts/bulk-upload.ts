/**
 * Bulk-ingest a folder of book files into the Islam24X7 upload pipeline.
 *
 * Works against BOTH storage paths automatically (probed via
 * GET /api/uploads/config):
 *  - "r2": presign → PUT directly to object storage → complete
 *  - "local": multipart POST through the Next.js server (dev only)
 *
 * Example — the 13-volume Tibyan-ul-Quran set:
 *
 *   bun scripts/bulk-upload.ts \
 *     --dir "C:/Users/moham/Downloads/Kamraan/WEB DEV/Islamic/Islam24x7/Books/Quran" \
 *     --api http://localhost:3000 \
 *     --series "Tibyan-ul-Quran" \
 *     --title "Tibyan-ul-Quran" \
 *     --author "Ghulam Rasool Saeedi" \
 *     --category tafsir --language ur \
 *     --manifest ./tibyan-manifest.json
 *
 * The optional --manifest is a JSON array of { file, pages } used for exact
 * page counts; volume labels ("Volume 7") are derived from `vol-NN` in the
 * filename when present.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

interface Args {
  dir: string;
  api: string;
  series?: string;
  title?: string;
  author: string;
  category: string;
  language: string;
  manifest?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string, def?: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
    return def;
  };
  const dir = get("dir");
  const author = get("author");
  if (!dir) throw new Error("Missing required --dir <folder>");
  if (!author) throw new Error("Missing required --author <name>");
  return {
    dir,
    api: (get("api", "http://localhost:3000") as string).replace(/\/+$/, ""),
    series: get("series"),
    title: get("title"),
    author,
    category: get("category", "tafsir") as string,
    language: get("language", "ur") as string,
    manifest: get("manifest"),
  };
}

function volumeLabelOf(filename: string): string | null {
  const stem = filename.replace(/\.[^.]+$/, "");
  // "…vol-01", "…vol_1" (any separator)…
  const vol = stem.match(/vol[_.\s-]?(\d{1,3})/i);
  if (vol) return `Volume ${Number(vol[1])}`;
  // …or a trailing number: "Sunan Nisaye 2", "Nisaye1".
  const trailing = stem.match(/(\d{1,3})$/);
  if (trailing) return `Volume ${Number(trailing[1])}`;
  return null;
}

function titleOf(filename: string, fallback: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const pretty = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  // "tibyan ul quran vol 01" -> drop the trailing vol marker, the
  // volumeLabel carries it.
  const withoutVol = pretty.replace(/\s*vol\.?\s*\d+\s*$/i, "").trim();
  return fallback || withoutVol || pretty;
}

async function apiJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let pageCounts = new Map<string, number>();
  if (args.manifest) {
    const list = JSON.parse(readFileSync(args.manifest, "utf8")) as Array<{
      file: string;
      pages: number;
    }>;
    for (const e of list) pageCounts.set(e.file.toLowerCase(), e.pages);
  }

  const files = readdirSync(args.dir)
    .filter((f) => /\.(pdf|docx|epub|txt|md)$/i.test(f))
    .sort();
  if (files.length === 0) throw new Error(`No book files found in ${args.dir}`);

  const cfg = await apiJson(`${args.api}/api/uploads/config`);
  if (!cfg.ok) throw new Error(`API unreachable at ${args.api} (${cfg.status})`);
  const provider = cfg.json.provider === "r2" ? "r2" : "local";
  console.log(`Provider: ${provider} · files: ${files.length}`);

  // Idempotency: skip files already stored as ready; clear stuck
  // non-ready rows from interrupted runs so they re-upload cleanly.
  const force = process.argv.includes("--force");
  const existing = new Map<string, { id: string; status: string }>();
  if (!force) {
    const list = await apiJson(`${args.api}/api/uploads?limit=500`);
    if (list.ok) {
      for (const item of ((list.json.items ?? []) as Array<{ id: string; originalFilename: string; status: string }>)) {
        existing.set(item.originalFilename.toLowerCase(), { id: item.id, status: item.status });
      }
    }
  }

  let done = 0;
  const failed: string[] = [];

  for (const filename of files) {
    const full = path.join(args.dir, filename);
    const size = statSync(full).size;
    const volumeLabel = volumeLabelOf(filename);
    const title = titleOf(filename, args.title ?? args.series ?? "");
    const meta = {
      title,
      author: args.author,
      category: args.category,
      language: args.language,
      ...(args.series ? { series: args.series } : {}),
      ...(volumeLabel ? { volumeLabel } : {}),
      ...(pageCounts.get(filename.toLowerCase())
        ? { pageCount: String(pageCounts.get(filename.toLowerCase())) }
        : {}),
    };
    const label = `${title}${volumeLabel ? ` — ${volumeLabel}` : ""}`;
    const prior = existing.get(filename.toLowerCase());
    if (prior?.status === "ready") {
      console.log(`[skip] already stored: ${label}`);
      continue;
    }
    if (prior) {
      // Stuck row from an interrupted run — remove, then upload fresh.
      await apiJson(
        `${args.api}/api/uploads/${encodeURIComponent(prior.id)}`,
        { method: "DELETE" }
      ).catch(() => ({ ok: false, status: 0, json: {} }));
      existing.delete(filename.toLowerCase());
    }
    try {
      if (provider === "r2") {
        const pre = await apiJson(`${args.api}/api/uploads/presign`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...meta,
            filename,
            mimeType: "application/pdf",
            fileSize: size,
          }),
        });
        if (!pre.ok) throw new Error(String(pre.json.error ?? `presign ${pre.status}`));
        const item = pre.json.item as { id: string };
        const buf = readFileSync(full);
        const put = await fetch(String(pre.json.uploadUrl), {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: buf as unknown as BodyInit,
        });
        if (!put.ok) throw new Error(`storage PUT ${put.status}`);
        const fin = await apiJson(
          `${args.api}/api/uploads/${encodeURIComponent(item.id)}/complete`,
          { method: "POST" }
        );
        if (!fin.ok) throw new Error(String(fin.json.error ?? `complete ${fin.status}`));
      } else {
        const fd = new FormData();
        fd.set("file", new Blob([readFileSync(full)] as unknown as BlobPart[], { type: "application/pdf" }), filename);
        for (const [k, v] of Object.entries(meta)) fd.set(k, String(v));
        const up = await apiJson(`${args.api}/api/uploads`, { method: "POST", body: fd });
        if (!up.ok) throw new Error(String(up.json.error ?? `upload ${up.status}`));
      }
      done += 1;
      console.log(`[${done}/${files.length}] OK   ${label}`);
    } catch (e) {
      failed.push(filename);
      console.error(`[x] FAIL ${label}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nDone: ${done} ok, ${failed.length} failed${failed.length ? ` (${failed.join(", ")})` : ""}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
