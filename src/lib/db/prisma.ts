import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function runtimeDatabaseUrl(): string {
  const configured = process.env.NODE_ENV === 'production'
    ? process.env.SUPABASE_POOLER_URL || process.env.DATABASE_URL
    : process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_URL || process.env.superbase_url || process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;
  if (process.env.NODE_ENV === 'production' && !configured?.trim()) {
    throw new Error('SUPABASE_POOLER_URL or DATABASE_URL must be configured for production database access.');
  }

  const databaseUrl = configured || 'postgresql://localhost:5432/lumentor';
  try {
    const url = new URL(databaseUrl);
    // Supabase uses the same pooler host for both modes. Runtime traffic must
    // use transaction pooling so idle serverless workers do not hold clients.
    if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '5432') {
      url.port = '6543';
      return url.toString();
    }
  } catch {
    throw new Error('The configured database URL is invalid.');
  }
  return databaseUrl;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const globalForDatabasePool = globalThis as unknown as { databasePool?: Pool };

function databasePool(): Pool {
  if (globalForDatabasePool.databasePool) return globalForDatabasePool.databasePool;

  const configuredMax = process.env.DATABASE_POOL_MAX;
  const max = configuredMax === undefined ? 3 : Number(configuredMax);
  if (!Number.isInteger(max) || max < 1 || max > 5) {
    throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 5.');
  }

  const pool = new Pool({
    connectionString: runtimeDatabaseUrl(),
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    keepAlive: true,
  });
  pool.on('error', (error) => {
    console.error('[database] PostgreSQL pool error', error);
  });
  globalForDatabasePool.databasePool = pool;
  return pool;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(databasePool()),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Reuse the client in every runtime, including production serverless workers.
// Creating a pool per request can exhaust Supabase's pooler client limit.
globalForPrisma.prisma = prisma;
