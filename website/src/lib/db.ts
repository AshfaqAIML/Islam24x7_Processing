import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Never crash at import time when DATABASE_URL is missing (e.g. a fresh
// Vercel build before env vars are set). The placeholder URL is
// unreachable, so every query fails fast and each caller degrades
// gracefully: the library serves demo data, the upload store reports
// "unavailable" instead of crashing the route.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://127.0.0.1:5432/unconfigured'
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db