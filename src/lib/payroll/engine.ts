import { db } from '../db/store';
import { Mentor, ClassEvent } from '../types/models';
import {
  PayrollPlan,
  PayrollLineItem,
  PayrollBatch,
  Payslip,
  PayslipItem,
  PayslipPenaltyItem,
} from '../types/payroll';
import { roundToTwoDecimals } from '../utils/formatters';

export interface CalculatePayrollOptions {
  periodId: string;
  startDate: string;
  endDate: string;
  branchId?: string; // undefined or 'ALL'
  mentorIds?: string[];
}

export class PayrollEngine {
  /**
   * Evaluates classes and computes line item for a single mentor.
   */
  public calculateMentorPayroll(
    mentor: Mentor,
    plan: PayrollPlan,
    classes: ClassEvent[],
    startDate: string,
    endDate: string,
    batchId: string
  ): PayrollLineItem {
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);

    // Filter mentor's classes in date range
    const mentorClasses = classes.filter((c) => {
      if (c.mentorId !== mentor.id) return false;
      const classDate = new Date(c.startTime);
      return classDate >= periodStart && classDate <= periodEnd;
    });

    let eligibleClassesCount = 0;
    let eligibleDurationMinutes = 0;
    let lateCancelledCount = 0;

    let classEarnings = 0;
    let durationEarnings = 0;
    let studentEarnings = 0;
    let revenueShareEarnings = 0;

    const calculationNotes: string[] = [];

    // Evaluate each class against plan eligibility rules
    for (const cls of mentorClasses) {
      // Check status eligibility
      const isStatusPayable = plan.payableClassStatuses.includes(cls.status);
      if (!isStatusPayable) {
        continue;
      }

      // Check minimum duration
      if (cls.durationMinutes < plan.minEligibleDurationMinutes) {
        calculationNotes.push(`Class ${cls.id} (${cls.title}) excluded: ${cls.durationMinutes}m is below minimum threshold ${plan.minEligibleDurationMinutes}m.`);
        continue;
      }

      eligibleClassesCount++;
      eligibleDurationMinutes += cls.durationMinutes;

      const isLateCancel = cls.status === 'LATE_CANCELLED' || cls.isLateCancellation;
      const lateMultiplier = isLateCancel ? (plan.lateCancellationPayPercent / 100) : 1.0;
      if (isLateCancel) lateCancelledCount++;

      // Subject or Branch rate overrides
      const baseClassRate = plan.subjectRates?.[cls.subjectId] ?? plan.branchRates?.[cls.branchId] ?? plan.defaultClassRate;
      const groupMultiplier = cls.isGroup ? plan.groupMultiplier : 1.0;

      // 1. Per Class Component
      if (plan.compensationModel === 'PER_CLASS' || plan.compensationModel === 'HYBRID') {
        const sessionPay = baseClassRate * groupMultiplier * lateMultiplier;
        classEarnings += sessionPay;
      }

      // 2. Duration Based Component ($/hour)
      if (plan.compensationModel === 'DURATION_BASED' || plan.compensationModel === 'HYBRID') {
        if (plan.hourlyRate > 0) {
          const hours = cls.durationMinutes / 60;
          const durationPay = hours * plan.hourlyRate * lateMultiplier;
          durationEarnings += durationPay;
        }
      }

      // 3. Per Student Component
      if (plan.compensationModel === 'PER_STUDENT' || plan.compensationModel === 'HYBRID') {
        if (plan.perStudentRate > 0) {
          // Count attending students
          const attendingCount = cls.students.filter(
            (s) => s.attendanceStatus === 'PRESENT' || s.attendanceStatus === 'LATE'
          ).length;
          const studentPay = attendingCount * plan.perStudentRate * lateMultiplier;
          studentEarnings += studentPay;
        }
      }

      // 4. Percentage Based Revenue Share Component
      if (plan.compensationModel === 'PERCENTAGE_BASED' || plan.compensationModel === 'HYBRID') {
        if (plan.revenuePercentage > 0) {
          // Dynamically compute session package revenue basis:
          // 1. From class package (price / sessions)
          // 2. From plan-configured sessionRevenueBasis
          // 3. Fallback to baseClassRate or plan default
          let sessionRevenueBasis = plan.sessionRevenueBasis;
          if (!sessionRevenueBasis && cls.packageId) {
            const pkg = db.getPackageById(cls.packageId);
            if (pkg && pkg.totalSessions > 0) {
              sessionRevenueBasis = pkg.price / pkg.totalSessions;
            }
          }
          if (!sessionRevenueBasis || sessionRevenueBasis <= 0) {
            sessionRevenueBasis = baseClassRate > 0 ? baseClassRate : 120.0;
          }
          const revShare = sessionRevenueBasis * (plan.revenuePercentage / 100) * lateMultiplier;
          revenueShareEarnings += revShare;
        }
      }
    }

    // Fixed Base Salary (Prorated for semi-monthly / monthly cycle)
    let baseSalaryAmount = 0;
    if (plan.compensationModel === 'FIXED_SALARY' || plan.compensationModel === 'HYBRID') {
      // If cycle is ~15 days, apply 50% of monthly base; if ~30 days, apply 100%
      const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const prorationFactor = days <= 16 ? 0.5 : 1.0;
      baseSalaryAmount = plan.baseSalary * prorationFactor;
      if (prorationFactor < 1.0) {
        calculationNotes.push(`Prorated base salary (${(prorationFactor * 100).toFixed(0)}% for ${days}-day cycle).`);
      }
    }

    // Approved Bonuses / Adjustments
    const adjustments = db.getAdjustments(mentor.id).filter(
      (a) => !a.appliedPayrollBatchId || a.appliedPayrollBatchId === batchId
    );
    const bonusAmount = adjustments.reduce((sum, a) => sum + a.amount, 0);

    // Approved Penalties (MUST be strictly APPROVED and not already APPLIED elsewhere)
    const approvedPenalties = db.getPenalties(mentor.id).filter(
      (p) => p.status === 'APPROVED' && (!p.appliedPayrollBatchId || p.appliedPayrollBatchId === batchId)
    );
    const penaltyDeductions = approvedPenalties.reduce((sum, p) => sum + p.amount, 0);
    const appliedPenaltyIds = approvedPenalties.map((p) => p.id);

    // Gross and Net
    const grossEarnings = roundToTwoDecimals(
      baseSalaryAmount + classEarnings + durationEarnings + studentEarnings + revenueShareEarnings + bonusAmount
    );
    const netPayable = roundToTwoDecimals(Math.max(0, grossEarnings - penaltyDeductions));

    return {
      id: `item-${batchId}-${mentor.id}`,
      batchId,
      mentorId: mentor.id,
      mentorName: `${mentor.firstName} ${mentor.lastName}`,
      mentorEmail: mentor.email,
      branchId: mentor.branchId,
      branchName: mentor.branchName || 'Primary Campus',
      payrollPlanId: plan.id,
      planVersion: plan.version,
      planName: plan.name,
      compensationModel: plan.compensationModel,
      eligibleClassesCount,
      eligibleDurationMinutes,
      baseSalaryAmount: roundToTwoDecimals(baseSalaryAmount),
      classEarnings: roundToTwoDecimals(classEarnings),
      durationEarnings: roundToTwoDecimals(durationEarnings),
      studentEarnings: roundToTwoDecimals(studentEarnings),
      revenueShareEarnings: roundToTwoDecimals(revenueShareEarnings),
      bonusAmount: roundToTwoDecimals(bonusAmount),
      penaltyDeductions: roundToTwoDecimals(penaltyDeductions),
      appliedPenaltyIds,
      grossEarnings,
      netPayable,
      calculationDetails: {
        classesEvaluated: mentorClasses.length,
        classesEligible: eligibleClassesCount,
        lateCancelledEligible: lateCancelledCount,
        appliedRateCard: `${plan.name} (v${plan.version}) - ${plan.compensationModel}`,
        notes: calculationNotes,
      },
    };
  }

  /**
   * Executes batch payroll calculation across mentors.
   */
  public generateBatch(options: CalculatePayrollOptions): PayrollBatch {
    const batchId = `batch-${Date.now()}`;
    const period = db.getPayrollPeriods().find((p) => p.id === options.periodId);
    const periodName = period?.name || `Payroll Period (${options.startDate} - ${options.endDate})`;

    const allMentors = db.getMentors(options.branchId);
    const selectedMentors = options.mentorIds
      ? allMentors.filter((m) => options.mentorIds!.includes(m.id))
      : allMentors;

    const allClasses = db.getClasses();
    const plans = db.getPayrollPlans();

    const lineItems: PayrollLineItem[] = [];

    for (const mentor of selectedMentors) {
      const plan = plans.find((p) => p.id === mentor.payrollPlanId) || plans[0];
      const item = this.calculateMentorPayroll(
        mentor,
        plan,
        allClasses,
        options.startDate,
        options.endDate,
        batchId
      );
      lineItems.push(item);
    }

    const totalGross = roundToTwoDecimals(lineItems.reduce((acc, i) => acc + i.grossEarnings, 0));
    const totalPenalties = roundToTwoDecimals(lineItems.reduce((acc, i) => acc + i.penaltyDeductions, 0));
    const totalAdjustments = roundToTwoDecimals(lineItems.reduce((acc, i) => acc + i.bonusAmount, 0));
    const totalNet = roundToTwoDecimals(lineItems.reduce((acc, i) => acc + i.netPayable, 0));
    const totalEligibleClasses = lineItems.reduce((acc, i) => acc + i.eligibleClassesCount, 0);

    const batch: PayrollBatch = {
      id: batchId,
      batchNumber: `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      periodId: options.periodId,
      periodName,
      startDate: options.startDate,
      endDate: options.endDate,
      branchId: options.branchId === 'ALL' ? undefined : options.branchId,
      branchName: options.branchId && options.branchId !== 'ALL' ? db.getBranchById(options.branchId)?.name : 'All Branches',
      status: 'DRAFT',
      totalMentors: lineItems.length,
      totalEligibleClasses,
      totalGross,
      totalPenalties,
      totalAdjustments,
      totalNet,
      currency: 'USD',
      paymentStatus: 'UNPAID',
      lineItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.savePayrollBatch(batch);
    return batch;
  }

  /**
   * Finalizes an approved batch: marks penalties APPLIED and generates immutable Payslips.
   */
  public finalizeBatchAndGeneratePayslips(batchId: string, lockedBy: string): Payslip[] {
    const batch = db.getPayrollBatchById(batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);

    if (batch.status !== 'APPROVED') {
      throw new Error(`Batch ${batch.batchNumber} must be in APPROVED state to finalize and lock.`);
    }

    batch.status = 'LOCKED';
    batch.lockedAt = new Date().toISOString();
    batch.updatedAt = new Date().toISOString();

    const generatedPayslips: Payslip[] = [];

    for (const item of batch.lineItems) {
      // 1. Mark penalties applied so they cannot be deducted again
      for (const penId of item.appliedPenaltyIds) {
        const pen = db.getPenaltyById(penId);
        if (pen) {
          pen.status = 'APPLIED';
          pen.appliedPayrollBatchId = batch.id;
          pen.appliedAt = new Date().toISOString();
        }
      }

      // 2. Build itemized earnings breakdown
      const earningsItems: PayslipItem[] = [];
      if (item.baseSalaryAmount > 0) {
        earningsItems.push({ description: 'Guaranteed Base Salary Component', amount: item.baseSalaryAmount });
      }
      if (item.classEarnings > 0) {
        earningsItems.push({
          description: `Completed Class Sessions (${item.eligibleClassesCount} classes)`,
          quantity: item.eligibleClassesCount,
          amount: item.classEarnings,
        });
      }
      if (item.durationEarnings > 0) {
        const hours = item.eligibleDurationMinutes / 60;
        earningsItems.push({
          description: `Teaching Duration (${hours.toFixed(1)} hours)`,
          quantity: hours,
          amount: item.durationEarnings,
        });
      }
      if (item.studentEarnings > 0) {
        earningsItems.push({ description: 'Student Participation Incentives', amount: item.studentEarnings });
      }
      if (item.revenueShareEarnings > 0) {
        earningsItems.push({ description: 'Package Revenue Share Basis', amount: item.revenueShareEarnings });
      }
      if (item.bonusAmount > 0) {
        earningsItems.push({ description: 'Approved Bonuses & Incentives', amount: item.bonusAmount });
      }

      // 3. Build itemized penalties
      const penaltyItems: PayslipPenaltyItem[] = item.appliedPenaltyIds.map((penId) => {
        const pen = db.getPenaltyById(penId);
        return {
          id: penId,
          category: pen?.category || 'Deduction',
          reason: pen?.reason || 'Approved penalty deduction',
          amount: pen?.amount || 0,
          date: pen?.createdAt ? pen.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        };
      });

      const payslip: Payslip = {
        id: `slip-${batch.id}-${item.mentorId}`,
        payslipNumber: `PS-${batch.startDate.replace(/-/g, '').slice(0, 6)}-${Math.floor(1000 + Math.random() * 9000)}`,
        batchId: batch.id,
        mentorId: item.mentorId,
        mentorName: item.mentorName,
        mentorEmail: item.mentorEmail,
        branchName: item.branchName,
        periodName: batch.periodName,
        startDate: batch.startDate,
        endDate: batch.endDate,
        generatedAt: new Date().toISOString(),
        planName: item.planName,
        compensationModel: item.compensationModel,
        planVersion: item.planVersion,
        eligibleClassesCount: item.eligibleClassesCount,
        eligibleDurationMinutes: item.eligibleDurationMinutes,
        earningsItems,
        penaltyItems,
        grossEarnings: item.grossEarnings,
        totalDeductions: item.penaltyDeductions,
        netPayable: item.netPayable,
        currency: batch.currency,
        paymentStatus: 'UNPAID',
      };

      db.savePayslip(payslip);
      generatedPayslips.push(payslip);
    }

    db.savePayrollBatch(batch);
    db.logAudit({
      userId: lockedBy,
      userName: lockedBy,
      userRole: 'ADMINISTRATOR',
      action: 'PAYROLL_LOCKED',
      entityType: 'PayrollBatch',
      entityId: batch.id,
      details: `Locked payroll batch ${batch.batchNumber} and generated ${generatedPayslips.length} payslips.`,
    });

    return generatedPayslips;
  }
}

export const payrollEngine = new PayrollEngine();
