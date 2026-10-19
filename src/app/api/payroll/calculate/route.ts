import { NextRequest, NextResponse } from 'next/server';
import { payrollEngine } from '../../../../lib/payroll/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { periodId, startDate, endDate, branchId, mentorIds } = body;

    if (!periodId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: periodId, startDate, endDate' },
        { status: 400 }
      );
    }

    const batch = payrollEngine.generateBatch({
      periodId,
      startDate,
      endDate,
      branchId,
      mentorIds,
    });

    return NextResponse.json(batch);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
