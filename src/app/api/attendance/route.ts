import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../lib/auth/server';
import { recordNormalizedAttendance } from '../../../lib/db/state-repository';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  try {
    await ensureServerPersistence();
    const body = await req.json();
    const { classId, roster, markedBy = 'Staff Administrator' } = body;

    if (!classId || !Array.isArray(roster)) {
      return NextResponse.json(
        { success: false, error: 'classId and roster array are required' },
        { status: 400 }
      );
    }

    const updated = await recordNormalizedAttendance(classId, roster, markedBy);
    const statuses = updated.students.map((student) => student.attendanceStatus);
    const summary = updated.attendanceStatusSummary;

    return NextResponse.json({
      success: true,
      message: 'Attendance recorded successfully',
      class: updated,
      summary: {
        totalStudents: updated.students.length,
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
