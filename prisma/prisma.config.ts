import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    // url: 'file:./prisma/dev.db',
    url: process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/sidepot',
  },
});
