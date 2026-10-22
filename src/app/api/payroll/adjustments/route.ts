import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { createAdjustment } from '../../../../lib/db/state-repository';

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'create');
  if (denied) return denied;
  try {
    const body = await req.json() as { mentorId?: string; type?: 'BONUS' | 'REIMBURSEMENT' | 'MANUAL_CORRECTION'; reason?: string; amount?: number; approvedBy?: string; approvedByName?: string };
    if (!body.mentorId || !body.reason?.trim() || !body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'Mentor, reason, and a positive amount are required.' }, { status: 400 });
    }
    const adjustment = await createAdjustment({
      mentorId: body.mentorId,
      type: body.type || 'BONUS',
      reason: body.reason.trim(),
      amount: Number(body.amount),
      approvedBy: body.approvedBy || 'pending',
    });
    return NextResponse.json({ success: true, adjustment }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to add incentive.' }, { status: 400 });
  }
}
