import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations must use a direct PostgreSQL connection. Neon poolers can
    // hold Prisma's advisory lock connection long enough to trigger P1002.
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '',
  },
});
