import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

if (process.env.NODE_ENV !== 'production' && databaseUrl) {
  console.log('[prisma] Using database URL:', databaseUrl.substring(0, 30) + '...');
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl && { datasourceUrl: databaseUrl }),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;