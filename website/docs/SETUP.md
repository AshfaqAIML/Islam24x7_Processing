# Setup — Islam24x7

## Prerequisites

- Bun (or Node 20+)
- The external Islamic Knowledge Base (optional in early phases — mock mode)

## Environment

Copy `.env.example` → `.env`. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Hosted Postgres (e.g. Neon pooled URL) for uploads & personal data |
| `KNOWLEDGE_BASE_API_URL` | Base URL of the external Knowledge Base API |
| `AI_API_URL` | AI/RAG endpoint (Phase 9). Keys stay server-side |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_BASE_URL` | Object storage (e.g. Cloudflare R2) for real book files — required in production |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `true` → clearly-labeled demo data mode |
| `APK_DOWNLOAD_URL` | `/downloads/…` or any https URL (CDN/GitHub) |
| `APK_VERSION` / `APK_RELEASE_DATE` / `APK_SIZE_LABEL` / `APK_MIN_ANDROID_VERSION` / `APK_CHANGELOG` | Release metadata surfaced on `/download` & the first-visit prompt |
| `NEXT_PUBLIC_APK_PROMPT_ENABLED` | Master switch for the first-visit APK prompt |
| `NEXT_PUBLIC_APK_PROMPT_RETRIGGER_DAYS` | Days to stay quiet after dismissal |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for SEO metadata |

Never put secrets in `NEXT_PUBLIC_*` variables.

## Book uploads (production: R2 + Postgres)

Real books — tafsir, hadith, translations, multi-volume sets — go through
`/admin/upload`. One file per volume, sharing a series name (e.g.
“Fatawa Rizvia”) with a volume label (“Volume 7”).

1. **Database** — create a free Neon Postgres project, paste the pooled
   URL into `DATABASE_URL`, then `bunx prisma db push`.
2. **Storage** — create an R2 bucket (e.g. `islam24x7-books`), an API
   token with Object Read & Write, and fill in the `S3_*` variables.
   `S3_PUBLIC_BASE_URL` is the public r2.dev subdomain or your own
   domain on the bucket.
3. **Bucket CORS** (required for browser uploads) — allow `PUT` from
   your site origin:
   ```json
   [{ "AllowedOrigins": ["https://your-site.vercel.app"],
      "AllowedMethods": ["PUT", "HEAD", "GET"],
      "AllowedHeaders": ["content-type"] }]
   ```
4. Uploads then stream **directly browser → R2** (presigned URLs), so
   ~1 GB volumes never pass through the Next.js server — this is what
   makes them work on Vercel despite its ~4.5 MB function body limit.
   Without `S3_*` set, the console falls back to local-disk upload
   (dev only, small files).

## Commands

```bash
bun install
bun run dev        # dev server on :3000 (logs → dev.log)
bun run lint       # ESLint / Next.js rules
bun run db:push    # push Prisma schema (personal-data phases)
bun run scripts/build-icons.ts   # derive icons from public/icons/*master.png
```

## Testing the first-visit APK flow

- Any desktop browser: no prompt (by design).
- `?apkPrompt=auto` — simulate an Android visitor while respecting
  dismissal state (full flow: show → dismiss → reload → hidden).
- `?apkPrompt=1` — force show, ignoring dismissal.
- `?apkPrompt=0` — force hide.
- `GET /api/downloads/track` shows the in-memory download counters.
- The `/download` page reports “unavailable” honestly until an APK artifact
  is placed in `public/downloads/islamic-knowledge.apk` (or
  `APK_DOWNLOAD_URL` points at a reachable host).
