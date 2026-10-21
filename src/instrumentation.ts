export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DEMO_MODE !== 'true') {
    const { db } = await import('./lib/db/store');
    await db.ready();
  }
}
