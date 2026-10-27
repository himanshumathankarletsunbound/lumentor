import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { sendAttendanceReminderEmail } from '../../../../lib/email/service';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ClassEvent, Mentor } from '../../../../lib/types/models';

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
    const {
      scheduleId,
      startDate,
      endDate,
      freezingDate = 'End of Month',
      payoutDate = 'Scheduled Payout Date',
      mentorIds,
      dispatchedBy = 'Operations Manager',
    } = body;

    const allMentors = db.getMentors();
    const allClasses = db.getClasses();

    // Determine target schedule if specified
    const schedule = scheduleId ? db.getPayoutScheduleById(scheduleId) : null;
    const effectiveStart = schedule?.startDate || startDate || '1970-01-01';
    const effectiveEnd = schedule?.endDate || endDate || '2099-12-31';
    const effectiveFreeze = schedule?.freezingDate || freezingDate;
    const effectivePayout = schedule?.payoutDate || payoutDate;

    // Filter mentors to consider
    const targetMentors = mentorIds && Array.isArray(mentorIds) && mentorIds.length > 0
      ? allMentors.filter((m: Mentor) => mentorIds.includes(m.id))
      : allMentors;

    const startObj = new Date(effectiveStart);
    const endObj = new Date(effectiveEnd);

    const notifiedMentors: Array<{
      id: string;
      name: string;
      email: string;
      unmarkedCount: number;
    }> = [];

    for (const mentor of targetMentors) {
      // Find mentor's unmarked classes in date range
      const unmarkedSessions = allClasses.filter((cls: ClassEvent) => {
        if (cls.mentorId !== mentor.id) return false;
        const cDate = new Date(cls.startTime);
        if (cDate < startObj || cDate > endObj) return false;
        return (
          cls.attendanceStatusSummary === 'UNMARKED' ||
          cls.status === 'SCHEDULED' ||
          cls.status === 'IN_PROGRESS'
        );
      });

      if (unmarkedSessions.length > 0 && mentor.email) {
        await sendAttendanceReminderEmail(
          mentor.email,
          `${mentor.firstName} ${mentor.lastName}`.trim(),
          unmarkedSessions.map((s: ClassEvent) => ({
            id: s.id,
            title: s.title,
            startTime: s.startTime,
            durationMinutes: s.durationMinutes,
            branchName: s.branchName,
          })),
          effectiveFreeze,
          effectivePayout
        );

        notifiedMentors.push({
          id: mentor.id,
          name: `${mentor.firstName} ${mentor.lastName}`.trim(),
          email: mentor.email,
          unmarkedCount: unmarkedSessions.length,
        });
      }
    }

    if (notifiedMentors.length > 0) {
      db.logAudit({
        userId: 'usr-admin-1',
        userName: dispatchedBy,
        userRole: 'ADMINISTRATOR',
        action: 'EMAIL_DISPATCHED',
        entityType: 'AttendanceReminder',
        entityId: scheduleId || 'cycle-general',
        details: `Dispatched attendance finalization reminders to ${notifiedMentors.length} faculty member(s) (${notifiedMentors.map((m) => m.name).join(', ')}). Freezing: ${effectiveFreeze}, Payout: ${effectivePayout}.`,
      });
    }

    return NextResponse.json({
      success: true,
      count: notifiedMentors.length,
      notifiedMentors,
      message:
        notifiedMentors.length > 0
          ? `Dispatched reminders to ${notifiedMentors.length} faculty member(s).`
          : 'No mentors currently have unmarked classes for the selected period.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
