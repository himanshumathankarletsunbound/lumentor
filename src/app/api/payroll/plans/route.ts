import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { listPayrollPlans } from '../../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
  if (denied) return denied;
  return NextResponse.json({ success: true, plans: (await listPayrollPlans()).filter((plan) => plan.isActive) });
}
