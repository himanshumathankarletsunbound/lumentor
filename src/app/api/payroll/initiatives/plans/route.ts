import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../../lib/db/server-initialization';
import { createInitiativePlan, listInitiativePlans } from '../../../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'payroll_rules', 'view');
    if (denied) return denied;
    return NextResponse.json({ success: true, plans: await listInitiativePlans() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to load initiative plans.' },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureServerPersistence();
    const denied = await authorizationErrorAsync(req, 'payroll_rules', 'create');
    if (denied) return denied;
    const body = await req.json();
    const amount = Number(body.amount);
    const payoutFactor = Number(body.payoutFactor ?? 1);
    if (!body.name?.trim() || !body.code?.trim() || !['INITIATIVE', 'FIXED_PAYOUT'].includes(body.planType) ||
      !Number.isFinite(amount) || amount < 0 || !Number.isFinite(payoutFactor) || payoutFactor < 0) {
      return NextResponse.json({ success: false, error: 'Name, unique code, type, non-negative amount, and payout factor are required.' }, { status: 400 });
    }
    const plan = await createInitiativePlan({
      name: body.name.trim(), code: body.code.trim().toUpperCase(), planType: body.planType,
      amount, payoutFactor, isActive: true,
    });
    return NextResponse.json({ success: true, plan }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to create initiative plan.' },
      { status: 503 }
    );
  }
}
