import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL must be set');
}

const sql = neon(databaseUrl);
const adapter = new PrismaNeon(sql as any);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}