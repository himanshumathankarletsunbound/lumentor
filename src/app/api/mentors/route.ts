import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { authorizationError } from '../../../lib/auth/server';
import { Mentor } from '../../../lib/types/models';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';

export async function GET(req: NextRequest) {
  try {
    await ensureServerPersistence();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Database initialization failed.' },
      { status: 503 }
    );
  }
  const denied = authorizationError(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    let mentors = db.getMentors();
    if (branchId && branchId !== 'ALL') {
      mentors = mentors.filter((m) => m.branchId === branchId);
    }

    return NextResponse.json({
      success: true,
      count: mentors.length,
      mentors,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureServerPersistence();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Database initialization failed.' },
      { status: 503 }
    );
  }
  const denied = authorizationError(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { id, payrollPlanId, branchId, status, hourlyRate, updatedBy = 'Administrator' } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Mentor id is required' },
        { status: 400 }
      );
    }

    const mentor = db.getMentorById(id);
    if (!mentor) {
      return NextResponse.json(
        { success: false, error: `Mentor ${id} not found` },
        { status: 404 }
      );
    }

    const updates: Partial<Mentor> = {};
    if (payrollPlanId) {
      const plan = db.getPayrollPlans().find((p) => p.id === payrollPlanId);
      if (!plan) {
        return NextResponse.json({ success: false, error: 'Invalid payrollPlanId' }, { status: 400 });
      }
      updates.payrollPlanId = payrollPlanId;
    }

    if (branchId) {
      const branch = db.getBranches().find((b) => b.id === branchId);
      if (!branch) {
        return NextResponse.json({ success: false, error: 'Invalid branchId' }, { status: 400 });
      }
      updates.branchId = branchId;
      updates.branchName = branch.name;
    }

    if (status) updates.status = status;
    if (hourlyRate !== undefined) updates.hourlyRate = Number(hourlyRate);

    const updated = db.updateMentor(id, updates);
    await db.persistNow();

    db.logAudit({
      userId: 'usr-admin-1',
      userName: updatedBy,
      userRole: 'ADMINISTRATOR',
      action: 'MENTOR_CONFIG_UPDATED',
      entityType: 'Mentor',
      entityId: id,
      details: `Updated mentor ${mentor.firstName} ${mentor.lastName} (plan: ${updates.payrollPlanId || mentor.payrollPlanId}, branch: ${updates.branchId || mentor.branchId}).`,
      branchId: updates.branchId || mentor.branchId,
    });
    await db.persistNow();

    return NextResponse.json({
      success: true,
      message: 'Mentor updated successfully',
      mentor: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
