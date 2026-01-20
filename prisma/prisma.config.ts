import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
      // Keep DATABASE_URL as the source of truth, but allow Prisma CLI to run even
      // if the variable isn't loaded in the current process.
      // Default DB for this repo: prisma/prisma/dev.db
      url: process.env.DATABASE_URL ?? 'file:./prisma/prisma/dev.db',
  },
});
