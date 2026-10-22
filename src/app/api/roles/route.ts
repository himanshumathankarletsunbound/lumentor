import { NextRequest, NextResponse } from 'next/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { createRole, listRoles } from '../../../lib/db/state-repository';
import { SystemRole } from '../../../lib/types/auth';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'users_roles', 'view');
  if (denied) return denied;
  return NextResponse.json({ success: true, roles: await listRoles() });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'users_roles', 'create');
  if (denied) return denied;
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ success: false, error: 'Role name is required.' }, { status: 400 });
    const role = await createRole({
      name,
      systemRole: 'CUSTOM' as SystemRole,
      description: String(body.description || 'Custom authorized organizational role'),
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
    });
    return NextResponse.json({ success: true, role }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create role.' }, { status: 500 });
  }
}
