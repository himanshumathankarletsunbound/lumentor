import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';
import { AttendanceStatus, ClassEvent } from '../../../lib/types/models';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, roster, markedBy = 'Staff Administrator' } = body;

    if (!classId || !Array.isArray(roster)) {
      return NextResponse.json(
        { success: false, error: 'classId and roster array are required' },
        { status: 400 }
      );
    }

    const cls = db.getClassById(classId);
    if (!cls) {
      return NextResponse.json(
        { success: false, error: `Class session ${classId} not found` },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const updatedStudents = cls.students.map((existing) => {
      const match = roster.find((r: { studentId: string; attendanceStatus: AttendanceStatus; notes?: string }) => r.studentId === existing.studentId);
      if (match) {
        return {
          ...existing,
          attendanceStatus: match.attendanceStatus,
          notes: match.notes !== undefined ? match.notes : existing.notes,
          markedAt: now,
          markedBy,
        };
      }
      return existing;
    });

    // Compute summary
    const statuses = updatedStudents.map((s) => s.attendanceStatus);
    let summary: ClassEvent['attendanceStatusSummary'] = 'UNMARKED';

    if (statuses.length > 0 && statuses.every((s) => s === 'PRESENT')) {
      summary = 'ALL_PRESENT';
    } else if (statuses.length > 0 && statuses.every((s) => s === 'ABSENT')) {
      summary = 'ALL_ABSENT';
    } else if (statuses.length > 0 && statuses.every((s) => s !== 'UNMARKED')) {
      summary = 'PARTIAL';
    }

    // Auto-complete class if scheduled and roster is now marked
    let newStatus = cls.status;
    if (cls.status === 'SCHEDULED' && summary !== 'UNMARKED') {
      newStatus = 'COMPLETED';
    }

    const updated = db.updateClass(classId, {
      students: updatedStudents,
      attendanceStatusSummary: summary,
      status: newStatus,
    });

    db.logAudit({
      userId: 'usr-ops-1',
      userName: markedBy,
      userRole: 'OPERATIONS',
      action: 'ATTENDANCE_RECORDED',
      entityType: 'ClassEvent',
      entityId: classId,
      details: `Recorded attendance for ${updatedStudents.length} students in "${cls.title}" (Outcome: ${summary}, Class: ${newStatus}).`,
      branchId: cls.branchId,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance recorded successfully',
      class: updated,
      summary: {
        totalStudents: updatedStudents.length,
        present: statuses.filter((s) => s === 'PRESENT').length,
        absent: statuses.filter((s) => s === 'ABSENT').length,
        late: statuses.filter((s) => s === 'LATE').length,
        excused: statuses.filter((s) => s === 'EXCUSED').length,
        unmarked: statuses.filter((s) => s === 'UNMARKED').length,
        attendanceStatusSummary: summary,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
