import { NextRequest, NextResponse } from 'next/server';
import { payrollEngine } from '../../../../lib/payroll/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId, lockedBy } = body;

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
    }

    const payslips = payrollEngine.finalizeBatchAndGeneratePayslips(batchId, lockedBy || 'Admin');
    return NextResponse.json({ success: true, count: payslips.length, payslips });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
