import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { authorizationError } from '../../../lib/auth/server';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req);
  if (denied) return denied;
  try {
    const branches = db.getBranches();
    return NextResponse.json({
      success: true,
      count: branches.length,
      branches,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, code, address, city, timezone, phone, email, createdBy = 'Administrator' } = body;

    if (!name || !code || !address || !city) {
      return NextResponse.json(
        { success: false, error: 'name, code, address, and city are required' },
        { status: 400 }
      );
    }

    const branch = db.createBranch({
      name,
      code: code.toUpperCase(),
      address,
      city,
      timezone: timezone || 'America/New_York',
      phone: phone || '+1 (555) 0100',
      email: email || `${code.toLowerCase()}@academyapex.com`,
      isActive: true,
      provenance: 'LOCALLY_CREATED',
    });

    db.logAudit({
      userId: 'usr-admin-1',
      userName: createdBy,
      userRole: 'ADMINISTRATOR',
      action: 'BRANCH_CREATED',
      entityType: 'Branch',
      entityId: branch.id,
      details: `Created new campus branch "${name}" (${branch.code}) in ${city}.`,
      branchId: branch.id,
    });
    await db.persistNow();

    return NextResponse.json({
      success: true,
      message: 'Branch created successfully',
      branch,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
