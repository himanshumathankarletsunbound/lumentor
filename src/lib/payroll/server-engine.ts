import { prisma } from '../db/prisma';
import { getOrganizationSettings, listClasses, listMentors, listPayrollPlans, listPenalties } from '../db/state-repository';
import { PayrollEngine, type CalculatePayrollOptions, type PayrollContext } from './engine';
import type { PayrollBatch } from '../types/payroll';

const engine = new PayrollEngine();

export async function generateBatchFromPostgres(options: CalculatePayrollOptions): Promise<PayrollBatch> {
  const batchId = `batch-${Date.now()}`;
  const [allMentors, allClasses, plans, penalties, adjustments, orgSettings] = await Promise.all([
    listMentors(options.branchId),
    listClasses({ branchId: options.branchId }),
    listPayrollPlans(),
    listPenalties(),
    prisma.adjustment.findMany({ select: { mentorId: true, amount: true, appliedPayrollBatchId: true } }),
    getOrganizationSettings().catch(() => ({ currency: 'INR' })),
  ]);
  const selectedMentors = options.mentorIds ? allMentors.filter((mentor) => options.mentorIds!.includes(mentor.id)) : allMentors;
  const context: PayrollContext = {
    adjustments: adjustments.map((item) => ({ mentorId: item.mentorId, amount: Number(item.amount), appliedPayrollBatchId: item.appliedPayrollBatchId })),
    penalties: penalties.map((item) => ({ id: item.id, mentorId: item.mentorId, status: item.status, amount: item.amount, appliedPayrollBatchId: item.appliedPayrollBatchId, category: item.category, reason: item.reason, createdAt: item.createdAt })),
  };
  const lineItems = selectedMentors.map((mentor) => {
    const plan = plans.find((item) => item.id === (options.payrollPlanId || mentor.payrollPlanId)) || plans[0];
    if (!plan) throw new Error(`No payroll plan is configured for ${mentor.firstName} ${mentor.lastName}.`);
    return engine.calculateMentorPayroll(mentor, plan, allClasses, options.startDate, options.endDate, batchId, context);
  });
  const batch: PayrollBatch = {
    id: batchId, batchNumber: `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
    periodId: options.periodId, periodName: `Payroll Period (${options.startDate} - ${options.endDate})`, startDate: options.startDate, endDate: options.endDate,
    branchId: options.branchId === 'ALL' ? undefined : options.branchId, status: 'DRAFT', totalMentors: lineItems.length,
    totalEligibleClasses: lineItems.reduce((sum, item) => sum + item.eligibleClassesCount, 0),
    totalGross: lineItems.reduce((sum, item) => sum + item.grossEarnings, 0),
    totalPenalties: lineItems.reduce((sum, item) => sum + item.penaltyDeductions, 0),
    totalAdjustments: lineItems.reduce((sum, item) => sum + item.bonusAmount, 0),
    totalNet: lineItems.reduce((sum, item) => sum + item.netPayable, 0),
    currency: orgSettings.currency || 'INR', paymentStatus: 'UNPAID', lineItems, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await prisma.payrollBatch.create({
    data: {
      id: batch.id, batchNumber: batch.batchNumber, periodName: batch.periodName, startDate: new Date(batch.startDate), endDate: new Date(batch.endDate),
      branchId: batch.branchId, totalMentors: batch.totalMentors, totalEligibleClasses: batch.totalEligibleClasses, totalGross: batch.totalGross,
      totalPenalties: batch.totalPenalties, totalAdjustments: batch.totalAdjustments, totalNet: batch.totalNet, currency: batch.currency,
      lineItems: { create: lineItems.map((item) => ({ id: item.id, mentorId: item.mentorId, payrollPlanId: item.payrollPlanId, planVersion: item.planVersion, planName: item.planName, compensationModel: item.compensationModel, eligibleClassesCount: item.eligibleClassesCount, eligibleDurationMinutes: item.eligibleDurationMinutes, baseSalaryAmount: item.baseSalaryAmount, classEarnings: item.classEarnings, durationEarnings: item.durationEarnings, studentEarnings: item.studentEarnings, revenueShareEarnings: item.revenueShareEarnings, bonusAmount: item.bonusAmount, penaltyDeductions: item.penaltyDeductions, appliedPenaltyIds: item.appliedPenaltyIds, grossEarnings: item.grossEarnings, netPayable: item.netPayable, calculationDetails: item.calculationDetails })) },
    },
  });
  return batch;
}

export async function finalizeBatchAndGeneratePayslipsFromPostgres(batchId: string) {
  const batch = await prisma.payrollBatch.findUnique({ where: { id: batchId }, include: { lineItems: true } });
  if (!batch) throw new Error(`Batch ${batchId} not found`);
  if (batch.status !== 'APPROVED') throw new Error(`Batch ${batch.batchNumber} must be in APPROVED state to finalize and lock.`);
  const lockedAt = new Date();
  return prisma.$transaction(async (transaction) => {
    const generated = [];
    for (const item of batch.lineItems) {
      const penalties = item.appliedPenaltyIds.length ? await transaction.penalty.findMany({ where: { id: { in: item.appliedPenaltyIds } } }) : [];
      await transaction.penalty.updateMany({ where: { id: { in: item.appliedPenaltyIds } }, data: { status: 'APPLIED', appliedPayrollBatchId: batch.id, appliedAt: lockedAt } });
      generated.push(await transaction.payslip.create({
        data: {
          id: `slip-${batch.id}-${item.mentorId}`, payslipNumber: `PS-${batch.startDate.toISOString().slice(0, 10).replace(/-/g, '').slice(0, 6)}-${Math.floor(1000 + Math.random() * 9000)}`,
          batchId: batch.id, mentorId: item.mentorId, periodName: batch.periodName, startDate: batch.startDate, endDate: batch.endDate,
          planName: item.planName, compensationModel: item.compensationModel, planVersion: item.planVersion, eligibleClassesCount: item.eligibleClassesCount,
          eligibleDurationMinutes: item.eligibleDurationMinutes, earningsItems: [{ description: 'Payroll earnings', amount: Number(item.grossEarnings) }],
          penaltyItems: penalties.map((penalty) => ({ id: penalty.id, category: penalty.category, reason: penalty.reason, amount: Number(penalty.amount), date: penalty.createdAt.toISOString().slice(0, 10) })),
          grossEarnings: item.grossEarnings, totalDeductions: item.penaltyDeductions, netPayable: item.netPayable, currency: batch.currency,
        },
      }));
    }
    await transaction.payrollBatch.update({ where: { id: batch.id }, data: { status: 'LOCKED', lockedAt } });
    return generated;
  });
}
