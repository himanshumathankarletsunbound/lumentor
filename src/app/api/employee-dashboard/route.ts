import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../lib/auth/server';
import { prisma } from '../../../lib/db/prisma';
import { ensureServerPersistence } from '../../../lib/db/server-initialization';
export async function GET(req: NextRequest) {
  await ensureServerPersistence(); const denied = await authorizationErrorAsync(req, 'employee_records', 'view'); if (denied) return denied;
  const user = await getSessionUserAsync(req);
  const employee = user ? await prisma.employee.findUnique({ where: { userId: user.id }, include: { leaveRequests: { orderBy: { createdAt: 'desc' }, take: 5 } } }) : null;
  if (!employee) return NextResponse.json({ success: true, employee: null });
  const gross = Number(employee.fixedPay) + Number(employee.variablePay); const tds = employee.tdsEnabled ? gross * Number(employee.tdsPercent || 0) / 100 : 0;
  return NextResponse.json({ success: true, employee, payout: { fixed: Number(employee.fixedPay), variable: Number(employee.variablePay), tds, net: gross - tds }, attendance: { present: 0, absent: 0, leave: employee.leaveRequests.filter(item => item.status === 'APPROVED').length } });
}
