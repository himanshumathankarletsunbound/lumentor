import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { createInitiativeEntry, listInitiativeEntries } from '../../../../lib/db/state-repository';
import { prisma } from '../../../../lib/db/prisma';
import { enforceRateLimit } from '../../../../lib/rate-limit/limiter';

export async function GET(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
    if (denied) return denied;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (!startDate || !endDate) return NextResponse.json({ success: false, error: 'startDate and endDate are required.' }, { status: 400 });
    return NextResponse.json({ success: true, entries: await listInitiativeEntries(startDate, endDate, searchParams.get('mentorId') || undefined) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to load initiatives.' },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'payroll_processing', 'create');
    if (denied) return denied;
    const body = await req.json();
    const amount = Number(body.amount);
    const count = Number(body.count);
    const payoutFactor = Number(body.payoutFactor ?? 1);
    if (!body.mentorId || !body.name?.trim() || !body.periodStart || !body.periodEnd ||
      !Number.isInteger(count) || count < 1 || !Number.isFinite(amount) || amount < 0 ||
      !Number.isFinite(payoutFactor) || payoutFactor < 0) {
      return NextResponse.json({ success: false, error: 'Mentor, name, dates, positive whole count, amount, and payout factor are required.' }, { status: 400 });
    }
    const entry = await createInitiativeEntry({
      mentorId: body.mentorId, planId: body.planId || undefined, name: body.name.trim(),
      amount, count, payoutFactor, periodStart: body.periodStart, periodEnd: body.periodEnd,
    });
    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to create initiative entry.' },
      { status: 503 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'payroll_processing', 'edit');
    if (denied) return denied;
    const rateLimitError = enforceRateLimit(req, { limit: 15, windowSeconds: 60, identifierPrefix: 'payroll-initiative-delete' });
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const mentorId = searchParams.get('mentorId');
    if (!id || !mentorId) return NextResponse.json({ success: false, error: 'Initiative and mentor IDs are required.' }, { status: 400 });

    const user = await getSessionUserAsync(req);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });
    const entry = await prisma.initiativeEntry.findUnique({ where: { id } });
    if (!entry || entry.mentorId !== mentorId) return NextResponse.json({ success: false, error: 'Incentive entry was not found.' }, { status: 404 });
    if (entry.appliedPayrollBatchId) {
      return NextResponse.json({ success: false, error: 'This incentive has already been finalized in a payout and cannot be removed.' }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.initiativeEntry.delete({ where: { id } }),
      prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: 'PAYROLL_INCENTIVE_REMOVED',
          entityType: 'InitiativeEntry',
          entityId: id,
          details: `Removed incentive "${entry.name}" for mentor ${mentorId} before payroll finalization.`,
        },
      }),
    ]);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to remove incentive.' },
      { status: 500 },
    );
  }
}
