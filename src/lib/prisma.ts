import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient as GeneratedPrismaClient } from '../../node_modules/.prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Keep this aligned with prisma/prisma.config.ts so the CLI (migrate/push/studio)
// and the runtime client point at the same SQLite file.
// Prisma config default: file:./prisma/prisma/dev.db
// const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/prisma/dev.db';
const databaseUrl = 'file:./prisma/prisma/dev.db';
const sqlitePath = databaseUrl.replace(/^file:/, '');


if (process.env.NODE_ENV !== 'production') {
  console.log('[prisma] DATABASE_URL =', databaseUrl);
  console.log('[prisma] sqlitePath    =', sqlitePath);
}

const adapter = new PrismaBetterSqlite3({
  url: sqlitePath as string & {},
});

export const prisma =
  globalForPrisma.prisma ??
  new GeneratedPrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;