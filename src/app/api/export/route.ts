import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'payroll';
    const batchId = searchParams.get('batchId');

    let csvContent = '';
    let filename = `export-${type}-${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'payroll') {
      const batches = db.getPayrollBatches();
      const batch = batchId ? batches.find((b) => b.id === batchId) || batches[0] : batches[0];
      filename = `payroll-${batch?.batchNumber || 'batch'}.csv`;

      csvContent = [
        'Batch Number,Period Start,Period End,Mentor Name,Compensation Model,Teaching Hours,Completed Classes,Gross Earnings,Deductions,Net Payable,Status',
        ...(batch?.lineItems || []).map((li) =>
          [
            `"${batch.batchNumber}"`,
            `"${batch.startDate}"`,
            `"${batch.endDate}"`,
            `"${li.mentorName}"`,
            `"${li.compensationModel}"`,
            (li.eligibleDurationMinutes / 60).toFixed(1),
            li.eligibleClassesCount,
            li.grossEarnings.toFixed(2),
            li.penaltyDeductions.toFixed(2),
            li.netPayable.toFixed(2),
            `"${batch.status}"`,
          ].join(',')
        ),
      ].join('\n');
    } else if (type === 'attendance') {
      const classes = db.getClasses();
      filename = `attendance-roster-${new Date().toISOString().split('T')[0]}.csv`;

      csvContent = [
        'Class Title,Branch,Subject,Mentor,Start Time,Student Name,Attendance Status,Marked At,Marked By',
        ...classes.flatMap((c) =>
          c.students.map((s) =>
            [
              `"${c.title}"`,
              `"${c.branchName}"`,
              `"${c.subjectName}"`,
              `"${c.mentorName}"`,
              `"${c.startTime}"`,
              `"${s.studentName}"`,
              `"${s.attendanceStatus}"`,
              `"${s.markedAt || ''}"`,
              `"${s.markedBy || ''}"`,
            ].join(',')
          )
        ),
      ].join('\n');
    } else if (type === 'penalties') {
      const penalties = db.getPenalties();
      filename = `penalties-audit-${new Date().toISOString().split('T')[0]}.csv`;

      csvContent = [
        'Penalty ID,Mentor ID,Category,Amount,Reason,Status,Created By,Created At,Approved By,Approved At',
        ...penalties.map((p) =>
          [
            `"${p.id}"`,
            `"${p.mentorId}"`,
            `"${p.category}"`,
            p.amount.toFixed(2),
            `"${p.reason.replace(/"/g, '""')}"`,
            `"${p.status}"`,
            `"${p.createdByName}"`,
            `"${p.createdAt}"`,
            `"${p.approvedByName || ''}"`,
            `"${p.approvedAt || ''}"`,
          ].join(',')
        ),
      ].join('\n');
    } else {
      const classes = db.getClasses();
      filename = `classes-catalog-${new Date().toISOString().split('T')[0]}.csv`;

      csvContent = [
        'Class ID,Title,Branch,Subject,Mentor,Start Time,Duration (Mins),Status,Attendance Summary,Provenance',
        ...classes.map((c) =>
          [
            `"${c.id}"`,
            `"${c.title}"`,
            `"${c.branchName}"`,
            `"${c.subjectName}"`,
            `"${c.mentorName}"`,
            `"${c.startTime}"`,
            c.durationMinutes,
            `"${c.status}"`,
            `"${c.attendanceStatusSummary}"`,
            `"${c.provenance}"`,
          ].join(',')
        ),
      ].join('\n');
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
