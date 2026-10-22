import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'approve');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'payroll-approve' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { batchId, approverId, approverName, action, rejectionReason } = body;

    const batch = db.getPayrollBatchById(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    if (action === 'SUBMIT') {
      batch.status = 'SUBMITTED';
      batch.submittedBy = approverId;
      batch.submittedByName = approverName;
      batch.submittedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      db.savePayrollBatch(batch);
      await db.persistNow();
      return NextResponse.json(batch);
    }

    if (action === 'APPROVE') {
      batch.status = 'APPROVED';
      batch.approvedBy = approverId;
      batch.approvedByName = approverName;
      batch.approvedAt = new Date().toISOString();
      batch.updatedAt = new Date().toISOString();
      db.savePayrollBatch(batch);

      db.logAudit({
        userId: approverId,
        userName: approverName,
        userRole: 'ADMINISTRATOR',
        action: 'PAYROLL_APPROVED',
        entityType: 'PayrollBatch',
        entityId: batch.id,
        details: `Approved payroll batch ${batch.batchNumber} (${batch.totalMentors} mentors, $${batch.totalNet} net).`,
      });

      await db.persistNow();
      return NextResponse.json(batch);
    } else if (action === 'REJECT') {
      batch.status = 'DRAFT';
      batch.updatedAt = new Date().toISOString();
      db.savePayrollBatch(batch);

      db.logAudit({
        userId: approverId,
        userName: approverName,
        userRole: 'ADMINISTRATOR',
        action: 'PAYROLL_RETURNED',
        entityType: 'PayrollBatch',
        entityId: batch.id,
        details: `Returned payroll batch ${batch.batchNumber} for corrections: ${rejectionReason || 'No reason specified'}`,
      });

      await db.persistNow();
      return NextResponse.json(batch);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
