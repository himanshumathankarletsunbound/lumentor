import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { createInitiativeEntry, listInitiativeEntries } from '../../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  if (!startDate || !endDate) return NextResponse.json({ success: false, error: 'startDate and endDate are required.' }, { status: 400 });
  return NextResponse.json({ success: true, entries: await listInitiativeEntries(startDate, endDate, searchParams.get('mentorId') || undefined) });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'create');
  if (denied) return denied;
  try {
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
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create initiative entry.' }, { status: 400 });
  }
}
