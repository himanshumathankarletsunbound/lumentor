import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { authorizationError, authorizationErrorAsync } from '../../../lib/auth/server';
import { listClasses } from '../../../lib/db/state-repository';
import { ClassEvent, ClassStudentRoster } from '../../../lib/types/models';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const mentorId = searchParams.get('mentorId') || undefined;
    const branchId = searchParams.get('branchId') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const classes = await listClasses({ mentorId, branchId, startDate, endDate, status });

    return NextResponse.json({
      success: true,
      count: classes.length,
      classes,
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
    const {
      title,
      subjectId,
      branchId,
      mentorId,
      startTime,
      durationMinutes,
      room,
      studentIds,
      createdBy = 'Operations Admin',
    } = body;

    if (!title || !subjectId || !branchId || !mentorId || !startTime || !durationMinutes) {
      return NextResponse.json(
        { success: false, error: 'Missing required class session attributes' },
        { status: 400 }
      );
    }

    const branch = db.getBranches().find((b) => b.id === branchId);
    const subject = db.getSubjects().find((s) => s.id === subjectId);
    const mentor = db.getMentors().find((m) => m.id === mentorId);

    if (!branch || !subject || !mentor) {
      return NextResponse.json(
        { success: false, error: 'Invalid branch, subject, or mentor reference' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + (durationMinutes || 60) * 60000);

    const allStudents = db.getStudents();
    const roster: ClassStudentRoster[] = (studentIds || []).map((sId: string) => {
      const st = allStudents.find((s) => s.id === sId);
      return {
        studentId: sId,
        studentName: st ? `${st.firstName} ${st.lastName}` : 'Enrolled Student',
        studentEmail: st ? st.email : '',
        attendanceStatus: 'UNMARKED',
      };
    });

    const newClass: ClassEvent = {
      id: `cls-loc-${Date.now()}`,
      title,
      subjectId,
      subjectName: subject.name,
      branchId,
      branchName: branch.name,
      mentorId,
      mentorName: `${mentor.firstName} ${mentor.lastName}`,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      isGroup: roster.length > 1,
      capacity: Math.max(roster.length, 10),
      isLateCancellation: false,
      status: 'SCHEDULED',
      attendanceStatusSummary: 'UNMARKED',
      students: roster,
      room: room || 'Room 101',
      provenance: 'LOCALLY_CREATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createClass(newClass);

    db.logAudit({
      userId: 'usr-ops-1',
      userName: createdBy,
      userRole: 'OPERATIONS',
      action: 'CLASS_SCHEDULED',
      entityType: 'ClassEvent',
      entityId: newClass.id,
      details: `Scheduled instructional session "${title}" with mentor ${newClass.mentorName} at ${newClass.branchName}.`,
      branchId,
    });
    await db.persistNow();

    return NextResponse.json({
      success: true,
      message: 'Class scheduled successfully',
      class: newClass,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { id, status, cancellationReason, cancelledBy, notes, room } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Class ID is required' },
        { status: 400 }
      );
    }

    const cls = db.getClassById(id);
    if (!cls) {
      return NextResponse.json(
        { success: false, error: `Class ${id} not found` },
        { status: 404 }
      );
    }

    const updates: Partial<ClassEvent> = {};
    if (status) {
      updates.status = status;
      if (status === 'CANCELLED' || status === 'LATE_CANCELLED') {
        updates.cancelledAt = new Date().toISOString();
        updates.cancelledBy = cancelledBy || 'Operations Staff';
        updates.cancellationReason = cancellationReason || 'Class cancelled';
      }
    }
    if (notes !== undefined) updates.notes = notes;
    if (room !== undefined) updates.room = room;

    const updated = db.updateClass(id, updates);

    db.logAudit({
      userId: 'usr-ops-1',
      userName: cancelledBy || 'Operations Staff',
      userRole: 'OPERATIONS',
      action: status ? `CLASS_STATUS_${status}` : 'CLASS_UPDATED',
      entityType: 'ClassEvent',
      entityId: id,
      details: `Updated class "${cls.title}" (status: ${status || cls.status}).`,
      branchId: cls.branchId,
    });
    await db.persistNow();

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully',
      class: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
