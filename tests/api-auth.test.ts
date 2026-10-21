import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { db } from '../src/lib/db/store';
import { GET as getUsers } from '../src/app/api/users/route';
import { GET as getSettings } from '../src/app/api/settings/org/route';
import { generateSessionToken } from '../src/lib/auth/crypto';

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost:3005${path}`, {
    headers: token ? { cookie: `lumentor_session=${token}` } : undefined,
  });
}

async function main() {
  db.resetToSeed();

  const unauthenticated = await getUsers(request('/api/users'));
  assert.equal(unauthenticated.status, 401);

  const admin = db.getUsers().find((user) => user.role === 'ADMINISTRATOR');
  assert(admin);
  const expiredToken = generateSessionToken();
  admin.sessionToken = expiredToken;
  admin.sessionExpiry = new Date(Date.now() - 1_000).toISOString();
  db.saveUser(admin);

  const expired = await getSettings(request('/api/settings/org', expiredToken));
  assert.equal(expired.status, 401);

  const operationsRole = db.getRoles().find((role) => role.systemRole === 'OPERATIONS');
  assert(operationsRole);
  const operations = {
    ...admin,
    id: 'test-operations',
    role: 'OPERATIONS' as const,
    permissions: operationsRole.permissions,
  };
  operations.sessionToken = generateSessionToken();
  operations.sessionExpiry = new Date(Date.now() + 60_000).toISOString();
  db.saveUser(operations);

  const forbidden = await getSettings(request('/api/settings/org', operations.sessionToken));
  assert.equal(forbidden.status, 403);

  console.log('[PASS] API authorization rejects unauthenticated, expired, and unauthorized sessions');
}

main().catch((error) => {
  console.error('[FAIL] API authorization integration test', error);
  process.exitCode = 1;
});
