import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { db } from '../../../../lib/db/store';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
  if (denied) return denied;
  return NextResponse.json({ success: true, plans: db.getPayrollPlans().filter((plan) => plan.isActive) });
}
