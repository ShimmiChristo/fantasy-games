import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

console.log('[Prisma] Environment check:', {
  hasPOSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
  hasDATABASE_URL: !!process.env.DATABASE_URL,
  databaseUrlPrefix: databaseUrl?.substring(0, 30),
  nodeEnv: process.env.NODE_ENV,
});

if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL must be set');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaNeon(pool as any);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;