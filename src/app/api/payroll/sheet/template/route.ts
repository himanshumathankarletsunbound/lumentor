import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync } from '../../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../../lib/db/server-initialization';
import { listInitiativePlans, listPayrollPlans } from '../../../../../lib/db/state-repository';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
  if (denied) return denied;
  const [payrollPlans, initiativePlans] = await Promise.all([listPayrollPlans(), listInitiativePlans()]);
  const headers = ['Mentor ID', ...payrollPlans.map((plan) => plan.code), ...initiativePlans.map((plan) => plan.code)];
  const example = ['mentor-id-or-external-id', ...payrollPlans.map(() => '0'), ...initiativePlans.map(() => '0')];
  const csv = `${headers.join(',')}\n${example.join(',')}\n`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sheet-payroll-template.csv"',
    },
  });
}
