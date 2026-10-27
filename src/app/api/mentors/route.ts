import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { createAuditEvent, listBranches, listMentors, listPayrollPlans, updateMentor } from '../../../lib/db/state-repository';
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
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    const mentors = await listMentors(branchId || undefined);

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
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { id, payrollPlanId, branchId, status, hourlyRate, payoutScheduleId, payoutDay, updatedBy = 'Administrator' } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Mentor id is required' },
        { status: 400 }
      );
    }

    const mentor = (await listMentors()).find((item) => item.id === id);
    if (!mentor) {
      return NextResponse.json(
        { success: false, error: `Mentor ${id} not found` },
        { status: 404 }
      );
    }

    const updates: Partial<Mentor> = {};
    if (payrollPlanId) {
      const plan = (await listPayrollPlans()).find((p) => p.id === payrollPlanId);
      if (!plan) {
        return NextResponse.json({ success: false, error: 'Invalid payrollPlanId' }, { status: 400 });
      }
      updates.payrollPlanId = payrollPlanId;
    }

    if (branchId) {
      const branch = (await listBranches()).find((b) => b.id === branchId);
      if (!branch) {
        return NextResponse.json({ success: false, error: 'Invalid branchId' }, { status: 400 });
      }
      updates.branchId = branchId;
      updates.branchName = branch.name;
    }

    if (status) updates.status = status;
    if (hourlyRate !== undefined) updates.hourlyRate = Number(hourlyRate);
    if (payoutScheduleId !== undefined) updates.payoutScheduleId = payoutScheduleId;
    if (payoutDay !== undefined) updates.payoutDay = Number(payoutDay);

    let updated: Mentor;
    try {
      updated = await updateMentor(id, updates);
    } catch {
      // Compatibility fallback to memory store
      const { db } = await import('../../../lib/db/store');
      updated = db.updateMentor(id, updates);
    }
    // Ensure in-memory db also has updates
    const { db } = await import('../../../lib/db/store');
    try {
      db.updateMentor(id, updates);
    } catch {
      // Ignore if already updated
    }
    await createAuditEvent({
      userId: 'usr-admin-1',
      userName: updatedBy,
      userRole: 'ADMINISTRATOR',
      action: 'MENTOR_CONFIG_UPDATED',
      entityType: 'Mentor',
      entityId: id,
      details: `Updated mentor ${mentor.firstName} ${mentor.lastName} (plan: ${updates.payrollPlanId || mentor.payrollPlanId}, branch: ${updates.branchId || mentor.branchId}).`,
      branchId: updates.branchId || mentor.branchId,
    });
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
