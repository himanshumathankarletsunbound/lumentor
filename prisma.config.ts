import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prefer an explicitly configured direct URL for migrations. If it is not
    // available, use the pooler so Prisma commands follow production runtime
    // connectivity instead of silently selecting the direct Supabase host.
    url: process.env.SUPABASE_DIRECT_URL
      || process.env.DIRECT_DATABASE_URL
      || process.env.SUPABASE_POOLER_URL
      || process.env.SUPABASE_URL
      || process.env.superbase_url
      || process.env.DATABASE_URL
      || process.env.NEON_DATABASE_URL
      || '',
  },
});
