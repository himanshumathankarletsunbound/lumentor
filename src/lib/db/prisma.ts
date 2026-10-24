import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function runtimeDatabaseUrl(): string {
  const configured = process.env.NODE_ENV === 'production'
    ? process.env.SUPABASE_POOLER_URL
    : process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_URL || process.env.superbase_url || process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;
  if (process.env.NODE_ENV === 'production' && !configured?.trim()) {
    throw new Error('SUPABASE_POOLER_URL must be configured for production database access.');
  }
  return configured || 'postgresql://localhost:5432/lumentor';
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: runtimeDatabaseUrl(),
    }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
