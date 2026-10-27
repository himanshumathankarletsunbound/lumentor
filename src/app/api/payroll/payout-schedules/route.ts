import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { PayoutSchedule } from '../../../../lib/types/payroll';
import { Mentor } from '../../../../lib/types/models';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { authorizationErrorAsync } from '../../../../lib/auth/server';

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
    const schedules = db.getPayoutSchedules();
    const mentors = db.getMentors();

    // Enrich schedules with assigned mentor count and details
    const enriched = schedules.map((s: PayoutSchedule) => {
      const assignedMentors = mentors.filter(
        (m: Mentor) =>
          m.payoutScheduleId === s.id ||
          (s.assignedMentorIds && s.assignedMentorIds.includes(m.id)) ||
          (m.payoutDay && m.payoutDay === s.payoutDay)
      );
      return {
        ...s,
        assignedMentorCount: assignedMentors.length,
        assignedMentors: assignedMentors.map((m: Mentor) => ({
          id: m.id,
          name: `${m.firstName} ${m.lastName}`.trim(),
          email: m.email,
          branchName: m.branchName,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      schedules: enriched,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
    const { action } = body;

    // Handle Freeze / Unfreeze actions
    if (action === 'FREEZE') {
      const { id, frozenBy = 'Administrator' } = body;
      if (!id) return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
      const updated = db.freezePayoutSchedule(id, frozenBy);
      db.logAudit({
        userId: 'usr-admin-1',
        userName: frozenBy,
        userRole: 'ADMINISTRATOR',
        action: 'PAYROLL_LOCKED',
        entityType: 'PayoutSchedule',
        entityId: id,
        details: `Froze payout schedule ${updated.name} (${updated.code}). Classes and attendances in this window are locked.`,
      });
      return NextResponse.json({ success: true, schedule: updated, message: 'Payout schedule frozen successfully.' });
    }

    if (action === 'UNFREEZE') {
      const { id, unfreezeBy = 'Administrator' } = body;
      if (!id) return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
      const updated = db.unfreezePayoutSchedule(id);
      db.logAudit({
        userId: 'usr-admin-1',
        userName: unfreezeBy,
        userRole: 'ADMINISTRATOR',
        action: 'PAYROLL_BATCH_DELETED',
        entityType: 'PayoutSchedule',
        entityId: id,
        details: `Unfroze payout schedule ${updated.name} (${updated.code}).`,
      });
      return NextResponse.json({ success: true, schedule: updated, message: 'Payout schedule unlocked.' });
    }

    // Standard Create or Update
    const {
      id,
      name,
      code,
      startDate,
      endDate,
      freezingDate,
      payoutDate,
      payoutDay = 3,
      frequency = 'MONTHLY',
      status = 'ACTIVE',
      description = '',
      assignedMentorIds = [],
      updatedBy = 'Administrator',
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Schedule name is required.' }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'Start Date and End Date are required.' }, { status: 400 });
    }
    if (!payoutDate) {
      return NextResponse.json({ success: false, error: 'Payout Date is required.' }, { status: 400 });
    }

    const scheduleId = id || `sched-${Date.now()}`;
    const scheduleCode = code || `SCHED-${payoutDay}-${Date.now().toString().slice(-4)}`;

    const newSchedule: PayoutSchedule = {
      id: scheduleId,
      name: name.trim(),
      code: scheduleCode.trim(),
      startDate,
      endDate,
      freezingDate: freezingDate || endDate,
      payoutDate,
      payoutDay: Number(payoutDay) || 3,
      frequency,
      status: status || 'ACTIVE',
      isFrozen: body.isFrozen || false,
      frozenAt: body.frozenAt,
      frozenBy: body.frozenBy,
      description: description.trim(),
      assignedMentorIds: Array.isArray(assignedMentorIds) ? assignedMentorIds : [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = db.savePayoutSchedule(newSchedule);

    // If mentors were assigned, update their payoutScheduleId & payoutDay
    if (Array.isArray(assignedMentorIds) && assignedMentorIds.length > 0) {
      for (const mId of assignedMentorIds) {
        try {
          db.updateMentor(mId, {
            payoutScheduleId: saved.id,
            payoutDay: saved.payoutDay,
          });
        } catch {
          // ignore if mentor not found
        }
      }
    }

    db.logAudit({
      userId: 'usr-admin-1',
      userName: updatedBy,
      userRole: 'ADMINISTRATOR',
      action: id ? 'MENTOR_CONFIG_UPDATED' : 'BATCH_CALCULATED',
      entityType: 'PayoutSchedule',
      entityId: saved.id,
      details: `${id ? 'Updated' : 'Created'} payout schedule ${saved.name} (Payout Day: ${saved.payoutDay}, Range: ${saved.startDate} to ${saved.endDate}, Freeze: ${saved.freezingDate}, Payout: ${saved.payoutDate}).`,
    });

    return NextResponse.json({
      success: true,
      schedule: saved,
      message: `Payout schedule ${saved.name} saved successfully.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
    }

    const schedule = db.getPayoutScheduleById(id);
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Payout schedule not found' }, { status: 404 });
    }

    db.deletePayoutSchedule(id);

    db.logAudit({
      userId: 'usr-admin-1',
      userName: 'Administrator',
      userRole: 'ADMINISTRATOR',
      action: 'PAYROLL_BATCH_DELETED',
      entityType: 'PayoutSchedule',
      entityId: id,
      details: `Deleted payout schedule ${schedule.name} (${schedule.code}).`,
    });

    return NextResponse.json({
      success: true,
      message: `Payout schedule ${schedule.name} removed.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
