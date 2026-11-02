import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
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
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
  worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 18) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet Payroll');
  const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new NextResponse(workbookBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="sheet-payroll-template.xlsx"',
    },
  });
}
