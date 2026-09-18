# API — Islam24x7

All Knowledge Base access flows through the app's own API routes, which wrap
the services layer (`src/services/*`). **The browser never talks to the
Knowledge Base or AI backend directly** — no secrets reach the client.

## Current routes (live)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/books?q=&category=&language=&sort=&page=&pageSize=` | Filter + paginate books |
| GET | `/api/books/:bookId` | One book (404 JSON if unknown) |
| GET | `/api/books/:bookId/chapters` | Table of contents |
| GET | `/api/books/:bookId/pages?chapterId=` | Reader pages |
| GET | `/api/search?q=&scope=all\|quran\|hadith\|books\|dua` | Global search (400 on bad input) |
| POST | `/api/ai/ask` `{question, scope, bookId?, chapterId?}` | Ask the library — **503 `connected:false` until `AI_API_URL` is set** |
| GET | `/api/ai/ask` | AI capability probe |
| GET | `/api/releases/latest` | APK release metadata + live availability |
| GET/POST | `/api/downloads/track` | Anonymous download counter |
| GET | `/api/uploads?status=&series=&limit=` | List ingested books (operator console) |
| GET | `/api/uploads/config` | Upload capability probe (`provider: r2\|local`, limits) |
| POST | `/api/uploads` (multipart) | Dev-disk upload fallback — 413 when object storage is configured |
| POST | `/api/uploads/presign` (JSON) | Production path: validate metadata + return presigned PUT URL |
| GET/DELETE | `/api/uploads/:id` | One ingested book / delete row + stored file |
| POST | `/api/uploads/:id/complete` | Verify the direct upload arrived → mark `ready` (fetchable) |

## Planned (per contract, `src/types/knowledge-base.ts`)

```
GET  /api/quran/surahs                → Surah[]            (Phase 6)
GET  /api/quran/surahs/:id?translation= → Surah & Ayah[]   (Phase 6)
GET  /api/hadith/collections          → HadithCollection[] (Phase 7)
GET  /api/hadith?collection=&page=    → Paginated<Hadith>  (Phase 7)
GET/POST /api/bookmarks | /api/notes | /api/reading-progress (Phase 8)
```

## Environment

| Variable | Side | Purpose |
|---|---|---|
| `KNOWLEDGE_BASE_API_URL` | server | Live data provider; unset/failed ⇒ labeled demo fallback |
| `AI_API_URL` | server | RAG endpoint for `/api/ai/ask`; unset ⇒ honest 503 |
| `DATABASE_URL` | server | Hosted Postgres; unreachable ⇒ uploads degrade to honest 503, library serves demo |
| `S3_*` | server | Object storage for book files; unset ⇒ local-disk dev fallback |
| `APK_*` | server | Release metadata (see APK_RELEASE.md) |
| `NEXT_PUBLIC_USE_MOCK_DATA` | client | Force demo mode |

Provider switching happens only inside the services layer
(`dataSource: "live" | "demo"`), so UI code never changes when the real
backend lands.
