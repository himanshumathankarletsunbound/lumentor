import { prisma } from '../db/prisma';
import { getOrganizationSettings, listClasses, listInitiativeEntries, listMentors, listPayrollPlans, listPenalties } from '../db/state-repository';
import { PayrollEngine, type CalculatePayrollOptions, type PayrollContext } from './engine';
import type { PayrollBatch } from '../types/payroll';

const engine = new PayrollEngine();

export async function generateBatchFromPostgres(options: CalculatePayrollOptions): Promise<PayrollBatch> {
  const batchId = `batch-${Date.now()}`;
  const [allMentors, allClasses, plans, penalties, adjustments, initiatives, orgSettings] = await Promise.all([
    listMentors(options.branchId),
    listClasses({ branchId: options.branchId, startDate: options.startDate, endDate: options.endDate }),
    listPayrollPlans(),
    listPenalties(),
    prisma.adjustment.findMany({ select: { mentorId: true, amount: true, appliedPayrollBatchId: true } }),
    listInitiativeEntries(options.startDate, options.endDate),
    getOrganizationSettings(),
  ]);
  const selectedMentors = options.mentorIds ? allMentors.filter((mentor) => options.mentorIds!.includes(mentor.id)) : allMentors;
  if (selectedMentors.length === 0) {
    throw new Error('No mentors matched the payroll calculation scope.');
  }
  const context: PayrollContext = {
    adjustments: adjustments.map((item) => ({ mentorId: item.mentorId, amount: Number(item.amount), appliedPayrollBatchId: item.appliedPayrollBatchId })),
    initiatives,
    penalties: penalties.map((item) => ({ id: item.id, mentorId: item.mentorId, status: item.status, amount: item.amount, appliedPayrollBatchId: item.appliedPayrollBatchId, category: item.category, reason: item.reason, createdAt: item.createdAt })),
  };
  const warnings: string[] = [];
  const lineItems = selectedMentors.flatMap((mentor) => {
    const mentorClasses = allClasses.filter((item) => item.mentorId === mentor.id);
    const groups = new Map<string, typeof allClasses>();
    for (const classEvent of mentorClasses) {
      const hasUnmarkedAttendance = classEvent.students.length === 0
        || classEvent.students.some((student) => student.attendanceStatus === 'UNMARKED');
      const hasBillableAbsence = classEvent.students.some((student) => student.attendanceStatus === 'ABSENT_BILLABLE');
      const hasPresentAttendance = classEvent.students.some(
        (student) => student.attendanceStatus === 'PRESENT' || student.attendanceStatus === 'LATE',
      );
      // A partially marked roster remains unmarked for payroll. This prevents
      // a submitted present record from paying an otherwise incomplete class.
      const planId = hasUnmarkedAttendance
        ? undefined
        : hasBillableAbsence
        ? options.classPayrollPlanOverrides?.[classEvent.id]
        : hasPresentAttendance
          ? classEvent.mappedPayrollPlanId
          : undefined;
      if (!planId) {
        if (hasUnmarkedAttendance) {
          continue;
        }
        if (hasBillableAbsence) {
          warnings.push(`Class ${classEvent.title} has billable absence attendance but no session payroll plan was selected.`);
        } else if (hasPresentAttendance) {
          warnings.push(`Class ${classEvent.title} has present attendance but no Title Mapper payroll plan.`);
        }
        continue;
      }
      const group = groups.get(planId) || [];
      group.push(classEvent);
      groups.set(planId, group);
    }
    if (groups.size === 0) {
      warnings.push(`No payable sessions were found for ${mentor.firstName} ${mentor.lastName}.`);
      return [];
    }

    return Array.from(groups.entries()).flatMap(([planId, classesForPlan], groupIndex) => {
      const plan = plans.find((item) => item.id === planId);
      if (!plan) {
        warnings.push(`Payroll plan ${planId} is not available for ${mentor.firstName} ${mentor.lastName}; sessions were skipped.`);
        return [];
      }
      const calculationPlan = groupIndex === 0
        ? plan
        : { ...plan, baseSalary: 0 };
      const calculationContext = groupIndex === 0
        ? context
        : { ...context, adjustments: [], initiatives: [], penalties: [] };
      const lineItem = engine.calculateMentorPayroll(
        mentor,
        calculationPlan,
        classesForPlan,
        options.startDate,
        options.endDate,
        `${batchId}-${mentor.id}-${planId}`,
        calculationContext,
      );
      return [{
        ...lineItem,
        id: `item-${batchId}-${mentor.id}-${planId}`,
        calculationDetails: {
          ...lineItem.calculationDetails,
          subjectPlanMapping: 'title-mapper-with-billable-absence-session-overrides',
        },
      }];
    });
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
    currency: orgSettings.currency || 'INR', paymentStatus: 'UNPAID', lineItems, warnings, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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
          id: `slip-${batch.id}-${item.id}`, payslipNumber: `PS-${batch.startDate.toISOString().slice(0, 10).replace(/-/g, '').slice(0, 6)}-${Math.floor(1000 + Math.random() * 9000)}`,
          batchId: batch.id, mentorId: item.mentorId, periodName: batch.periodName, startDate: batch.startDate, endDate: batch.endDate,
          planName: item.planName, compensationModel: item.compensationModel, planVersion: item.planVersion, eligibleClassesCount: item.eligibleClassesCount,
          eligibleDurationMinutes: item.eligibleDurationMinutes, earningsItems: [{ description: 'Payroll earnings', amount: Number(item.grossEarnings) }],
          penaltyItems: penalties.map((penalty) => ({ id: penalty.id, category: penalty.category, reason: penalty.reason, amount: Number(penalty.amount), date: penalty.createdAt.toISOString().slice(0, 10) })),
          grossEarnings: item.grossEarnings, totalDeductions: item.penaltyDeductions, netPayable: item.netPayable, currency: batch.currency,
        },
      }));
    }
    await transaction.initiativeEntry.updateMany({
      where: {
        mentorId: { in: batch.lineItems.map((item) => item.mentorId) },
        periodStart: { lte: batch.endDate },
        periodEnd: { gte: batch.startDate },
        appliedPayrollBatchId: null,
      },
      data: { appliedPayrollBatchId: batch.id },
    });
    await transaction.payrollBatch.update({ where: { id: batch.id }, data: { status: 'LOCKED', lockedAt } });
    return generated;
  });
}
