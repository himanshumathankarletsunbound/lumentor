import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/store';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';
import { authorizationError } from '../../../../lib/auth/server';

export async function POST(req: NextRequest) {
  const denied = authorizationError(req, 'payroll_processing', 'approve');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'payroll-pay' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { batchId, paymentReference, paidBy } = body;

    const batch = db.getPayrollBatchById(batchId);
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    batch.paymentStatus = 'PAID';
    batch.paidAt = new Date().toISOString();
    batch.paymentReference = paymentReference || `ACH-${Date.now()}`;
    batch.updatedAt = new Date().toISOString();
    db.savePayrollBatch(batch);

    // Update associated payslips
    const payslips = db.getPayslips().filter((p) => p.batchId === batch.id);
    for (const slip of payslips) {
      slip.paymentStatus = 'PAID';
      slip.paidAt = batch.paidAt;
      slip.paymentReference = batch.paymentReference;
      db.savePayslip(slip);
    }

    db.logAudit({
      userId: paidBy || 'user-admin',
      userName: paidBy || 'Admin',
      userRole: 'ADMINISTRATOR',
      action: 'PAYROLL_PAID',
      entityType: 'PayrollBatch',
      entityId: batch.id,
      details: `Recorded disbursement for batch ${batch.batchNumber} with ref ${batch.paymentReference}`,
    });

    return NextResponse.json({ success: true, batch });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
