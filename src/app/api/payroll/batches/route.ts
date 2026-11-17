import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserAsync, authorizationErrorAsync } from '../../../../lib/auth/server';
import { prisma } from '../../../../lib/db/prisma';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';

function serializeBatch(batch: Awaited<ReturnType<typeof prisma.payrollBatch.findMany>>[number] & {
  lineItems: Array<{
    id: string;
    mentorId: string;
    planName: string;
    eligibleClassesCount: number;
    grossEarnings: { toString(): string };
    netPayable: { toString(): string };
    mentor: { firstName: string; lastName: string; email: string };
  }>;
}) {
  return {
    ...batch,
    totalGross: Number(batch.totalGross),
    totalPenalties: Number(batch.totalPenalties),
    totalAdjustments: Number(batch.totalAdjustments),
    totalNet: Number(batch.totalNet),
    startDate: batch.startDate.toISOString(),
    endDate: batch.endDate.toISOString(),
    submittedAt: batch.submittedAt?.toISOString(),
    approvedAt: batch.approvedAt?.toISOString(),
    lockedAt: batch.lockedAt?.toISOString(),
    paidAt: batch.paidAt?.toISOString(),
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    lineItems: batch.lineItems.map((item) => ({
      ...item,
      mentorName: `${item.mentor.firstName} ${item.mentor.lastName}`.trim(),
      mentorEmail: item.mentor.email,
      grossEarnings: Number(item.grossEarnings),
      netPayable: Number(item.netPayable),
    })),
  };
}

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
  if (denied) return denied;

  const batches = await prisma.payrollBatch.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      lineItems: {
        include: { mentor: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { mentor: { firstName: 'asc' } },
      },
    },
  });
  return NextResponse.json({ success: true, batches: batches.map(serializeBatch) });
}

export async function DELETE(req: NextRequest) {
  await ensureServerPersistence();
  // Draft removal is intentionally restricted to payroll approvers. A generated
  // payout must never be deleted by a preparer without the same authority used
  // to finalize it.
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'approve');
  if (denied) return denied;
  const rateLimitError = enforceRateLimit(req, { limit: 10, windowSeconds: 60, identifierPrefix: 'payroll-batch-delete' });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json() as { batchId?: unknown };
    if (typeof body.batchId !== 'string' || !body.batchId.trim()) {
      return NextResponse.json({ success: false, error: 'A payroll batch ID is required.' }, { status: 400 });
    }
    const batchId = body.batchId;

    const user = await getSessionUserAsync(req);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });
    const removed = await prisma.$transaction(async (transaction) => {
      const batch = await transaction.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lineItems: { select: { mentorId: true } }, payslips: { select: { id: true } } },
      });
      if (!batch) throw new Error('Payroll batch was not found.');
      if (batch.status !== 'DRAFT') {
        throw new Error('Only draft payouts can be deleted. Submitted, approved, finalized, and paid payouts are retained in history.');
      }
      if (batch.payslips.length > 0) {
        throw new Error('This payout already has payslips and cannot be deleted.');
      }

      await transaction.payrollBatch.delete({ where: { id: batch.id } });
      await transaction.auditEvent.create({
        data: {
          userId: user.id,
          action: 'PAYROLL_DRAFT_DELETED',
          entityType: 'PayrollBatch',
          entityId: batch.id,
          details: `Deleted draft payout ${batch.batchNumber}; removed the complete batch and all ${batch.lineItems.length} mentor payout line(s).`,
        },
      });
      return { batchNumber: batch.batchNumber, mentorCount: batch.lineItems.length };
    });

    return NextResponse.json({ success: true, ...removed });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to delete payroll batch.' },
      { status: 400 },
    );
  }
}
