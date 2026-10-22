export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DEMO_MODE !== 'true') {
    try {
      const repository = await import('./lib/db/state-repository');
      globalThis.lumentorPostgresRepository = repository;
      const { db } = await import('./lib/db/store');
      await db.ready();
    } catch (error) {
      // Keep the server available so API routes can return an actionable JSON
      // configuration/database error instead of an opaque HTML startup page.
      console.error('PostgreSQL application state initialization failed:', error);
    }
  }
}
