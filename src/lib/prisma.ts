import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Vercel's Neon integration provides POSTGRES_PRISMA_URL.
const databaseUrl = process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  throw new Error('POSTGRES_PRISMA_URL must be set. Check Vercel environment variables.');
}

// Pass the connection string directly to the adapter.
const adapter = new PrismaNeon(databaseUrl);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}