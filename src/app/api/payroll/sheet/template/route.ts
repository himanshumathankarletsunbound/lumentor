import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { authorizationErrorAsync } from '../../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../../lib/db/server-initialization';
import { listInitiativePlans, listPayrollPlans, listPenaltyPolicies } from '../../../../../lib/db/state-repository';
import { FINAL_SHEET_INITIATIVE_CODES, FINAL_SHEET_PAYROLL_PLAN_CODES, FINAL_SHEET_PENALTY_CODES } from '../../../../../lib/payroll/sheet-payroll-catalog';

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
  if (denied) return denied;
  const [payrollPlans, initiativePlans, penaltyPolicies] = await Promise.all([listPayrollPlans(), listInitiativePlans(), listPenaltyPolicies()]);
  const configuredCodes = [...payrollPlans, ...initiativePlans, ...penaltyPolicies]
    .map((item) => item.code)
    .filter((code): code is string => Boolean(code))
    .map((code) => code.trim());
  const codes = [...FINAL_SHEET_PAYROLL_PLAN_CODES, ...FINAL_SHEET_INITIATIVE_CODES, ...FINAL_SHEET_PENALTY_CODES, ...configuredCodes]
    .filter((code, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === code.toLowerCase()) === index);
  const headers = ['Mentor ID', ...codes];
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
