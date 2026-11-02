import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { prisma } from '../../../../lib/db/prisma';
import { listInitiativePlans, listMentors, listPayrollPlans, listPenaltyPolicies } from '../../../../lib/db/state-repository';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { FINAL_SHEET_INITIATIVE_CODES, FINAL_SHEET_PAYROLL_PLAN_CODES, FINAL_SHEET_PENALTY_CODES, normalizeSheetCode } from '../../../../lib/payroll/sheet-payroll-catalog';

type SheetRow = Record<string, string>;

function parseCsv(input: string): SheetRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  if (rows.length < 2) throw new Error('The uploaded CSV must contain a header row and at least one mentor row.');
  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error('The CSV contains an empty column header.');
  return rows.slice(1).filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function parseSpreadsheet(buffer: ArrayBuffer): SheetRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('The uploaded Excel workbook does not contain a worksheet.');
  const values = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '' });
  if (values.length < 2) throw new Error('The uploaded Excel sheet must contain a header row and at least one mentor row.');
  const headers = values[0].map((header) => String(header).trim());
  if (headers.some((header) => !header)) throw new Error('The Excel sheet contains an empty column header.');
  return values.slice(1)
    .filter((values) => values.some((value) => String(value).trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()])));
}

function numberValue(value: string | undefined, label: string): number {
  const parsed = value?.trim() ? Number(value) : 0;
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative number.`);
  return parsed;
}

function valueFor(row: SheetRow, ...names: string[]): string | undefined {
  const entry = Object.entries(row).find(([key]) => names.some((name) => key.toLowerCase().replace(/[\s_-]/g, '') === name.toLowerCase().replace(/[\s_-]/g, '')));
  return entry?.[1];
}

function monthDates(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Select a valid payroll month.');
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Select a valid payroll month.');
  return { start, end };
}

async function createSheetBatch(file: File, month: string) {
  const { start, end } = monthDates(month);
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  const rows = isExcel ? parseSpreadsheet(await file.arrayBuffer()) : parseCsv(await file.text());
  const [mentors, payrollPlans, initiativePlans, penaltyPolicies] = await Promise.all([listMentors(), listPayrollPlans(), listInitiativePlans(), listPenaltyPolicies()]);
  const mentorById = new Map<string, (typeof mentors)[number]>();
  mentors.forEach((mentor) => {
    mentorById.set(mentor.id, mentor);
    if (mentor.externalId) mentorById.set(mentor.externalId, mentor);
  });
  const payrollByCode = new Map(payrollPlans.map((plan) => [normalizeSheetCode(plan.code), plan]));
  const initiativeByCode = new Map(initiativePlans.map((plan) => [normalizeSheetCode(plan.code), plan]));
  const penaltyByCode = new Map(penaltyPolicies.flatMap((policy) => policy.code ? [[normalizeSheetCode(policy.code), policy] as const] : []));
  const planColumns = new Set([...payrollByCode.keys(), ...initiativeByCode.keys(), ...penaltyByCode.keys()]);
  const lineItems = rows.map((row, index) => {
    const mentorKey = valueFor(row, 'mentorid', 'mentor')?.trim();
    const mentor = mentorKey ? mentorById.get(mentorKey) : undefined;
    if (!mentor) throw new Error(`Row ${index + 2}: mentor ID "${mentorKey || '(empty)'}" was not found.`);
    const presentCount = 0;
    const absentCount = 0;
    const absentBillableCount = 0;
    const durationMinutes = 0;
    const breakdown: Array<{ code: string; planId?: string; name: string; category: string; count: number; rate: number; amount: number }> = [];
    for (const [header, rawCount] of Object.entries(row)) {
      const code = normalizeSheetCode(header);
      if (!planColumns.has(code)) continue;
      const count = numberValue(rawCount, `${header} count`);
      if (count === 0) continue;
      const isPenalty = FINAL_SHEET_PENALTY_CODES.some((candidate) => normalizeSheetCode(candidate) === code);
      const isInitiative = FINAL_SHEET_INITIATIVE_CODES.some((candidate) => normalizeSheetCode(candidate) === code);
      const isPayrollPlan = FINAL_SHEET_PAYROLL_PLAN_CODES.some((candidate) => normalizeSheetCode(candidate) === code);
      const payrollPlan = isPayrollPlan || (!isPenalty && !isInitiative) ? payrollByCode.get(code) : undefined;
      const initiativePlan = isInitiative ? initiativeByCode.get(code) : undefined;
      if (isPenalty) {
        const penaltyPolicy = penaltyByCode.get(code);
        if (!penaltyPolicy) throw new Error(`Row ${index + 2}: penalty policy "${header}" is not configured in the database.`);
        const amount = count * penaltyPolicy.defaultAmount;
        breakdown.push({ code: penaltyPolicy.code || code, name: penaltyPolicy.name, category: 'PENALTY', count, rate: penaltyPolicy.defaultAmount, amount: Math.round(amount * 100) / 100 });
      } else if (payrollPlan) {
        let rate = payrollPlan.defaultClassRate;
        let amount = 0;
        if (payrollPlan.compensationModel === 'PER_CLASS') amount = count * rate;
        else if (payrollPlan.compensationModel === 'DURATION_BASED') {
          rate = payrollPlan.hourlyRate;
          amount = count * rate;
        } else if (payrollPlan.compensationModel === 'PER_STUDENT') {
          rate = payrollPlan.perStudentRate;
          amount = count * rate;
        } else if (payrollPlan.compensationModel === 'FIXED_SALARY') {
          rate = payrollPlan.baseSalary;
          amount = count * rate;
        } else if (payrollPlan.compensationModel === 'HYBRID') {
          rate = payrollPlan.defaultClassRate;
          amount = payrollPlan.baseSalary + count * rate;
        } else {
          throw new Error(`Row ${index + 2}: percentage payroll plan ${payrollPlan.code} cannot be calculated from counts alone.`);
        }
        breakdown.push({ code: payrollPlan.code, planId: payrollPlan.id, name: payrollPlan.name, category: 'PAYROLL_PLAN', count, rate, amount: Math.round(amount * 100) / 100 });
      } else if (initiativePlan) {
        const amount = count * initiativePlan.amount * initiativePlan.payoutFactor;
        breakdown.push({ code: initiativePlan.code, name: initiativePlan.name, category: 'INITIATIVE', count, rate: initiativePlan.amount * initiativePlan.payoutFactor, amount: Math.round(amount * 100) / 100 });
      } else {
        throw new Error(`Row ${index + 2}: "${header}" is not configured in the database.`);
      }
    }
    if (!breakdown.length) throw new Error(`Row ${index + 2}: add at least one non-zero payroll-plan or initiative-plan count.`);
    const grossEarnings = Math.round(breakdown.filter((item) => item.category !== 'PENALTY').reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const policyDeductions = Math.round(breakdown.filter((item) => item.category === 'PENALTY').reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const totalAmount = Math.round((grossEarnings - policyDeductions) * 100) / 100;
    const tds = Math.round(totalAmount * 0.1 * 100) / 100;
    const deductions = Math.round((tds + policyDeductions) * 100) / 100;
    const netPayable = Math.round((totalAmount - tds) * 100) / 100;
    return { mentorId: mentor.id, presentCount, absentCount, absentBillableCount, durationMinutes, grossEarnings, deductions, netPayable, breakdown };
  });
  const batchNumber = `SHEET-${month.replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const batch = await prisma.sheetPayrollBatch.create({
    data: {
      batchNumber, periodName: `Sheet Payroll - ${month}`, startDate: start, endDate: end, sourceFileName: file.name,
      totalMentors: lineItems.length, totalGross: lineItems.reduce((sum, item) => sum + item.grossEarnings, 0),
      totalDeductions: lineItems.reduce((sum, item) => sum + item.deductions, 0), totalNet: lineItems.reduce((sum, item) => sum + item.netPayable, 0),
      lineItems: { create: lineItems.map((item) => ({ ...item, breakdown: item.breakdown as unknown as Prisma.InputJsonValue })) },
    },
    include: { lineItems: { include: { mentor: true } } },
  });
  return serializeBatch(batch);
}

function serializeBatch(batch: Awaited<ReturnType<typeof prisma.sheetPayrollBatch.create>> & { lineItems: Array<{ mentor: { firstName: string; lastName: string; email: string }; id: string; mentorId: string; presentCount: number; absentCount: number; absentBillableCount: number; durationMinutes: number; grossEarnings: Prisma.Decimal; deductions: Prisma.Decimal; netPayable: Prisma.Decimal; breakdown: unknown; reviewStatus: string; reviewerRemark: string | null }> }) {
  return {
    ...batch,
    totalGross: Number(batch.totalGross),
    totalDeductions: Number(batch.totalDeductions),
    totalNet: Number(batch.totalNet),
    lineItems: batch.lineItems.map((item) => {
      const breakdown = item.breakdown as Array<{ category: string; amount: number }>;
      const policyDeductions = Math.round(breakdown.filter((entry) => entry.category === 'PENALTY').reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
      const totalAmount = Math.round((Number(item.grossEarnings) - policyDeductions) * 100) / 100;
      return { ...item, mentorName: `${item.mentor.firstName} ${item.mentor.lastName}`.trim(), mentorEmail: item.mentor.email, grossEarnings: Number(item.grossEarnings), totalAmount, deductions: Number(item.deductions), netPayable: Number(item.netPayable) };
    }),
  };
}

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'view');
  if (denied) return denied;
  const batches = await prisma.sheetPayrollBatch.findMany({ orderBy: { createdAt: 'desc' }, include: { lineItems: { include: { mentor: true } } } });
  return NextResponse.json({ success: true, batches: batches.map(serializeBatch) });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_processing', 'create');
  if (denied) return denied;
  try {
    const user = await getSessionUserAsync(req);
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      const month = String(form.get('month') || '');
      if (!(file instanceof File) || !/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error('Upload a CSV or Excel (.xlsx/.xls) file.');
      return NextResponse.json({ success: true, batch: await createSheetBatch(file, month) });
    }
    const body = await req.json() as { action?: string; batchId?: string; lineItemId?: string; reviewStatus?: string; remark?: string };
    if (!body.batchId) throw new Error('batchId is required.');
    if (body.action === 'REVIEW_LINE') {
      if (!body.lineItemId || !['APPROVED', 'CHANGES_REQUESTED'].includes(body.reviewStatus || '')) throw new Error('A valid line review status is required.');
      const item = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.sheetPayrollLineItem.update({ where: { id: body.lineItemId, batchId: body.batchId }, data: { reviewStatus: body.reviewStatus, reviewerRemark: body.remark?.trim() || null, reviewedBy: user?.id, reviewedAt: new Date() } });
        if (body.reviewStatus === 'CHANGES_REQUESTED') {
          await transaction.sheetPayrollBatch.update({ where: { id: body.batchId }, data: { status: 'CHANGES_REQUESTED', reviewedBy: user?.id, reviewedAt: new Date() } });
        }
        return updated;
      });
      return NextResponse.json({ success: true, lineItem: item });
    }
    if (body.action === 'SUBMIT') {
      const batch = await prisma.sheetPayrollBatch.update({ where: { id: body.batchId }, data: { status: 'SUBMITTED', submittedBy: user?.id, submittedAt: new Date() }, include: { lineItems: { include: { mentor: true } } } });
      return NextResponse.json({ success: true, batch: serializeBatch(batch) });
    }
    if (body.action === 'REQUEST_CHANGES') {
      const batch = await prisma.sheetPayrollBatch.update({ where: { id: body.batchId }, data: { status: 'CHANGES_REQUESTED', reviewedBy: user?.id, reviewedAt: new Date() } });
      return NextResponse.json({ success: true, batch });
    }
    if (body.action === 'APPROVE') {
      const batch = await prisma.sheetPayrollBatch.findUnique({ where: { id: body.batchId }, include: { lineItems: { include: { mentor: true } } } });
      if (!batch) throw new Error('Sheet payroll batch not found.');
      if (batch.status !== 'SUBMITTED' || batch.lineItems.some((item) => item.reviewStatus !== 'APPROVED')) throw new Error('Every mentor line must be reviewed and approved before final approval.');
      const result = await prisma.$transaction(async (transaction) => {
        const payrollBatch = await transaction.payrollBatch.create({ data: { batchNumber: `${batch.batchNumber}-FINAL`, periodName: batch.periodName, startDate: batch.startDate, endDate: batch.endDate, currency: batch.currency, status: 'LOCKED', lockedAt: new Date(), totalMentors: batch.totalMentors, totalGross: batch.totalGross, totalPenalties: batch.totalDeductions, totalAdjustments: 0, totalNet: batch.totalNet, lineItems: { create: batch.lineItems.map((item) => { const details = item.breakdown as Array<{ code: string; planId?: string; name: string; category: string; count: number; rate: number; amount: number }>; const firstPlan = details.find((entry) => entry.category === 'PAYROLL_PLAN'); return { mentorId: item.mentorId, payrollPlanId: firstPlan?.planId || item.mentor.payrollPlanId, planVersion: 1, planName: firstPlan?.name || 'Sheet-based payroll', compensationModel: 'PER_CLASS', eligibleClassesCount: item.presentCount + item.absentBillableCount, eligibleDurationMinutes: item.durationMinutes, baseSalaryAmount: 0, classEarnings: details.filter((entry) => entry.category === 'PAYROLL_PLAN').reduce((sum, entry) => sum + entry.amount, 0), durationEarnings: 0, studentEarnings: 0, revenueShareEarnings: 0, bonusAmount: details.filter((entry) => entry.category === 'INITIATIVE').reduce((sum, entry) => sum + entry.amount, 0), penaltyDeductions: item.deductions, appliedPenaltyIds: [], grossEarnings: item.grossEarnings, netPayable: item.netPayable, calculationDetails: { source: 'SHEET_PAYROLL', breakdown: details, notes: ['Calculated from an uploaded sheet.'] } }; }) } } });
        for (const item of batch.lineItems) {
          const details = item.breakdown as Array<{ code: string; planId?: string; name: string; category: string; count: number; rate: number; amount: number }>;
          const policyDeductions = Math.round(details.filter((detail) => detail.category === 'PENALTY').reduce((sum, detail) => sum + detail.amount, 0) * 100) / 100;
          const totalAmount = Math.round((Number(item.grossEarnings) - policyDeductions) * 100) / 100;
          const tds = Math.round(totalAmount * 0.1 * 100) / 100;
          await transaction.payslip.create({ data: { payslipNumber: `PS-${batch.batchNumber}-${item.mentorId.slice(0, 8)}`, batchId: payrollBatch.id, mentorId: item.mentorId, periodName: batch.periodName, startDate: batch.startDate, endDate: batch.endDate, planName: details.map((detail) => detail.name).join(', '), compensationModel: 'PER_CLASS', planVersion: 1, eligibleClassesCount: 0, eligibleDurationMinutes: 0, earningsItems: details.filter((detail) => detail.category !== 'PENALTY').map((detail) => ({ description: `${detail.category === 'INITIATIVE' ? 'Initiative' : 'Payroll plan'}: ${detail.name}`, quantity: detail.count, rate: detail.rate, amount: detail.amount })), penaltyItems: [...details.filter((detail) => detail.category === 'PENALTY').map((detail) => ({ id: `penalty-${item.id}-${detail.code}`, category: 'Penalty', reason: detail.name, amount: detail.amount, date: batch.endDate.toISOString().slice(0, 10) })), { id: `tds-${item.id}`, category: 'TDS (10%)', reason: 'Mandatory tax deduction after payroll and penalties', amount: tds, date: batch.endDate.toISOString().slice(0, 10) }], grossEarnings: item.grossEarnings, totalDeductions: item.deductions, netPayable: item.netPayable, currency: batch.currency } });
        }
        return transaction.sheetPayrollBatch.update({ where: { id: batch.id }, data: { status: 'LOCKED', reviewedBy: user?.id, reviewedAt: new Date() } });
      });
      return NextResponse.json({ success: true, batch: result });
    }
    throw new Error('Unsupported sheet payroll action.');
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Sheet payroll request failed.' }, { status: 400 });
  }
}
