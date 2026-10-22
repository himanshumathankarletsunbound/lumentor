import * as postgresRepository from './state-repository';
import { db } from './store';

let initialization: Promise<void> | undefined;

export function ensureServerPersistence(): Promise<void> {
  initialization ??= (async () => {
    globalThis.lumentorPostgresRepository = postgresRepository;
    await db.ready();
  })();
  return initialization;
}
