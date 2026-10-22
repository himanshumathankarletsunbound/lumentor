import { NextRequest, NextResponse } from 'next/server';
import { markPayrollBatchPaid } from '../../../../lib/db/state-repository';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'approve');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'payroll-pay' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { batchId, paymentReference } = body;

    const batch = await markPayrollBatchPaid(batchId, paymentReference || `ACH-${Date.now()}`);
    return NextResponse.json({ success: true, batch });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
