import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { AppDatabase } from './store';

const STATE_ID = 'lumentor';
const jsonState = (state: AppDatabase): Prisma.InputJsonValue => {
  const persisted = JSON.parse(JSON.stringify(state)) as AppDatabase;
  persisted.classcardConfig.apiKey = '';
  persisted.emailConfig.pass = '';
  persisted.emailConfig.oauthClientSecret = '';
  persisted.emailConfig.oauthRefreshToken = '';
  return persisted as unknown as Prisma.InputJsonValue;
};

export async function loadAppState(): Promise<Partial<AppDatabase> | null> {
  const record = await prisma.appState.findUnique({ where: { id: STATE_ID } });
  return (record?.state as Partial<AppDatabase> | undefined) ?? null;
}

export async function saveAppState(state: AppDatabase): Promise<void> {
  await prisma.appState.upsert({
    where: { id: STATE_ID },
    create: { id: STATE_ID, state: jsonState(state) },
    update: { state: jsonState(state) },
  });
}
