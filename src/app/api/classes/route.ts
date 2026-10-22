import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { createNormalizedClass, listClasses, updateNormalizedClass } from '../../../lib/db/state-repository';
import { prisma } from '../../../lib/db/prisma';
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
  const denied = await authorizationErrorAsync(req);
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
    } = body;

    if (!title || !subjectId || !branchId || !mentorId || !startTime || !durationMinutes) {
      return NextResponse.json(
        { success: false, error: 'Missing required class session attributes' },
        { status: 400 }
      );
    }

    const [branch, subject, mentor] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId } }),
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.mentor.findUnique({ where: { id: mentorId } }),
    ]);
    if (!branch || !subject || !mentor) {
      return NextResponse.json(
        { success: false, error: 'Invalid branch, subject, or mentor reference' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + (durationMinutes || 60) * 60000);

    const newClass = await createNormalizedClass({
      title,
      subjectId,
      branchId,
      mentorId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      isGroup: (studentIds || []).length > 1,
      capacity: Math.max((studentIds || []).length, 10),
      studentIds: Array.isArray(studentIds) ? studentIds : [],
      room: room || 'Room 101',
    });

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
  const denied = await authorizationErrorAsync(req);
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

    const updates: {
      status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'LATE_CANCELLED';
      cancellationReason?: string;
      cancelledAt?: string;
      cancelledBy?: string;
      notes?: string;
      room?: string;
    } = {};
    if (status) {
      updates.status = status as typeof updates.status;
      if (status === 'CANCELLED' || status === 'LATE_CANCELLED') {
        updates.cancelledAt = new Date().toISOString();
        updates.cancelledBy = cancelledBy || 'Operations Staff';
        updates.cancellationReason = cancellationReason || 'Class cancelled';
      }
    }
    if (notes !== undefined) updates.notes = notes;
    if (room !== undefined) updates.room = room;

    let updated;
    try {
      updated = await updateNormalizedClass(id, updates);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return NextResponse.json({ success: false, error: `Class ${id} not found` }, { status: 404 });
      }
      throw error;
    }

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
