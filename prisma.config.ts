import 'dotenv/config'; // Make sure your .env file is loaded
import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
