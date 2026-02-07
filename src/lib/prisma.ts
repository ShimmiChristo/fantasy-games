import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

// Validate database URL in production
if (process.env.NODE_ENV === 'production' && !databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL must be set in production');
}

if (process.env.NODE_ENV !== 'production' && databaseUrl) {
  console.log('[prisma] Using database URL:', databaseUrl.substring(0, 30) + '...');
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;