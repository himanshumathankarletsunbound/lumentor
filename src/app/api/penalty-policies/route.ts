import { NextRequest, NextResponse } from 'next/server';
import { authorizationError, getSessionUser } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
import { db } from '../../../lib/db/store';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req, 'penalties', 'view');
  if (denied) return denied;
  return NextResponse.json({ success: true, policies: db.getPenaltyPolicies().filter((policy) => policy.isActive) });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req, 'penalties', 'create');
  if (denied) return denied;
  if (getSessionUser(req)?.role !== 'ADMINISTRATOR') {
    return NextResponse.json({ success: false, error: 'Only administrators can manage penalty policies.' }, { status: 403 });
  }
  try {
    const body = await req.json() as { name?: string; description?: string; defaultAmount?: number };
    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Policy name is required.' }, { status: 400 });
    }
    const policy = db.createPenaltyPolicy({
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      defaultAmount: Number(body.defaultAmount) || 0,
      isActive: true,
    });
    await db.persistNow();
    return NextResponse.json({ success: true, policy }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create policy.' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req, 'penalties', 'delete');
  if (denied) return denied;
  if (getSessionUser(req)?.role !== 'ADMINISTRATOR') {
    return NextResponse.json({ success: false, error: 'Only administrators can manage penalty policies.' }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Policy id is required.' }, { status: 400 });
  db.deletePenaltyPolicy(id);
  await db.persistNow();
  return NextResponse.json({ success: true });
}
