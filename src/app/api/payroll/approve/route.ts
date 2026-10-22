import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { updatePayrollBatchStatus } from '../../../../lib/db/state-repository';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'approve');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'payroll-approve' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { batchId, approverId, action } = body;

    if (action === 'SUBMIT') {
      const batch = await updatePayrollBatchStatus({ id: batchId, status: 'SUBMITTED', userId: approverId });
      return NextResponse.json(batch);
    }

    if (action === 'APPROVE') {
      const batch = await updatePayrollBatchStatus({ id: batchId, status: 'APPROVED', userId: approverId });
      return NextResponse.json(batch);
    } else if (action === 'REJECT') {
      const batch = await updatePayrollBatchStatus({ id: batchId, status: 'DRAFT' });
      return NextResponse.json(batch);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
