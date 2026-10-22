import { NextRequest, NextResponse } from 'next/server';
import { payrollEngine } from '../../../../lib/payroll/engine';
import { db } from '../../../../lib/db/store';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationError } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = authorizationError(req, 'payroll_processing', 'approve');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'payroll-lock' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { batchId, lockedBy } = body;

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
    }

    const payslips = payrollEngine.finalizeBatchAndGeneratePayslips(batchId, lockedBy || 'Admin');
    await db.persistNow();
    return NextResponse.json({ success: true, count: payslips.length, payslips });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
