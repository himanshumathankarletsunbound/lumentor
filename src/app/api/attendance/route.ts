import { NextRequest, NextResponse } from "next/server";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../lib/auth/server";
import {
  listAttendanceSummaries,
  recordNormalizedAttendance,
} from "../../../lib/db/state-repository";
import { ensureServerPersistence } from "../../../lib/db/server-initialization";
import { prisma } from "../../../lib/db/prisma";

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  const user = await getSessionUserAsync(req);
  if (user?.mentorId)
    return NextResponse.json({ success: true, summaries: [] });
  const params = req.nextUrl.searchParams;
  const reportType = params.get("reportType");
  const summaries = await listAttendanceSummaries({
    reportType:
      reportType === "BY_CLASS" || reportType === "BY_SUBJECT"
        ? reportType
        : undefined,
    studentId: params.get("studentId") || undefined,
    subjectId: params.get("subjectId") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  });
  return NextResponse.json({ success: true, summaries });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req);
  if (denied) return denied;
  const user = await getSessionUserAsync(req);
  try {
    await ensureServerPersistence();
    const body = await req.json();
    const { classId, roster, markedBy = "Staff Administrator" } = body;

    if (!classId || !Array.isArray(roster)) {
      return NextResponse.json(
        { success: false, error: "classId and roster array are required" },
        { status: 400 },
      );
    }
    if (user?.mentorId) {
      const event = await prisma.classEvent.findUnique({
        where: { id: classId },
        select: { mentorId: true },
      });
      if (!event || event.mentorId !== user.mentorId) {
        return NextResponse.json(
          {
            success: false,
            error: "You can mark attendance only for your own sessions.",
          },
          { status: 403 },
        );
      }
    }

    const updated = await recordNormalizedAttendance(classId, roster, markedBy);
    const statuses = updated.students.map(
      (student) => student.attendanceStatus,
    );
    const summary = updated.attendanceStatusSummary;

    return NextResponse.json({
      success: true,
      message: "Attendance recorded successfully",
      class: updated,
      summary: {
        totalStudents: updated.students.length,
        present: statuses.filter((s) => s === "PRESENT").length,
        absent: statuses.filter((s) => s === "ABSENT").length,
        late: statuses.filter((s) => s === "LATE").length,
        excused: statuses.filter((s) => s === "EXCUSED").length,
        unmarked: statuses.filter((s) => s === "UNMARKED").length,
        attendanceStatusSummary: summary,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
