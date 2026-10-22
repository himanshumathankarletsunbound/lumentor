import { ClassStatus } from './models';

export type CompensationModel =
  | 'PER_CLASS'
  | 'DURATION_BASED'
  | 'PER_STUDENT'
  | 'FIXED_SALARY'
  | 'PERCENTAGE_BASED'
  | 'HYBRID';

export interface PayrollPlan {
  id: string;
  name: string;
  code: string;
  description: string;
  compensationModel: CompensationModel;
  currency: string;
  baseSalary: number;
  defaultClassRate: number;
  hourlyRate: number;
  perStudentRate: number;
  revenuePercentage: number;
  sessionRevenueBasis?: number; // Configurable per-session revenue basis for percentage-based models
  minEligibleDurationMinutes: number;
  payableClassStatuses: ClassStatus[];
  lateCancellationPayPercent: number; // e.g. 50%
  groupMultiplier: number;
  subjectRates?: Record<string, number>; // subjectId -> rate
  branchRates?: Record<string, number>;  // branchId -> rate
  formula?: string; // Configured / customizable mathematical calculation formula
  version: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PenaltyCategory =
  | 'LATE_CANCELLATION'
  | 'UNAPPROVED_ABSENCE'
  | 'MISSING_ATTENDANCE'
  | 'POLICY_VIOLATION'
  | 'ADMINISTRATIVE'
  | 'OTHER'
  | (string & {});

export type PenaltyDeductionType = 'PERCENT' | 'FIXED_AMOUNT';

export interface PenaltyPolicy {
  id: string;
  code?: string;
  name: string;
  description: string;
  deductionType?: PenaltyDeductionType;
  rateValue?: number;
  defaultAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PenaltyStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPLIED'
  | 'REVERSED';

export interface Penalty {
  id: string;
  mentorId: string;
  mentorName: string;
  classId?: string;
  branchId: string;
  branchName?: string;
  category: PenaltyCategory;
  reason: string;
  amount: number;
  evidenceNote?: string;
  evidenceUrl?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status: PenaltyStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  appliedPayrollBatchId?: string;
  appliedAt?: string;
  reversedBy?: string;
  reversedByName?: string;
  reversedAt?: string;
  reversalReason?: string;
  disputeStatus?: 'NONE' | 'DISPUTED' | 'RESOLVED';
  disputeNote?: string;
}

export interface Adjustment {
  id: string;
  mentorId: string;
  mentorName: string;
  type: 'BONUS' | 'REIMBURSEMENT' | 'MANUAL_CORRECTION';
  reason: string;
  amount: number;
  approvedBy: string;
  approvedByName: string;
  appliedPayrollBatchId?: string;
  createdAt: string;
}

export type PayrollBatchStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'LOCKED'
  | 'PAID';

export interface PayrollPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'PROCESSING' | 'APPROVED' | 'LOCKED' | 'PAID';
  createdAt: string;
}

export interface PayrollLineItem {
  id: string;
  batchId: string;
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  branchId: string;
  branchName: string;
  payrollPlanId: string;
  planVersion: number;
  planName: string;
  compensationModel: CompensationModel;
  eligibleClassesCount: number;
  eligibleDurationMinutes: number;
  baseSalaryAmount: number;
  classEarnings: number;
  durationEarnings: number;
  studentEarnings: number;
  revenueShareEarnings: number;
  bonusAmount: number;
  penaltyDeductions: number;
  appliedPenaltyIds: string[];
  grossEarnings: number;
  netPayable: number;
  calculationDetails: {
    classesEvaluated: number;
    classesEligible: number;
    lateCancelledEligible: number;
    appliedRateCard: string;
    notes: string[];
  };
}

export interface PayrollBatch {
  id: string;
  batchNumber: string;
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  branchId?: string; // undefined or 'ALL' for org-wide
  branchName?: string;
  status: PayrollBatchStatus;
  totalMentors: number;
  totalEligibleClasses: number;
  totalGross: number;
  totalPenalties: number;
  totalAdjustments: number;
  totalNet: number;
  currency: string;
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  lockedAt?: string;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAt?: string;
  paymentReference?: string;
  lineItems: PayrollLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PayslipItem {
  description: string;
  quantity?: number;
  rate?: number;
  amount: number;
}

export interface PayslipPenaltyItem {
  id: string;
  category: string;
  reason: string;
  amount: number;
  date: string;
}

export interface Payslip {
  id: string;
  payslipNumber: string;
  batchId: string;
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  branchName: string;
  periodName: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  planName: string;
  compensationModel: CompensationModel;
  planVersion: number;
  eligibleClassesCount: number;
  eligibleDurationMinutes: number;
  earningsItems: PayslipItem[];
  penaltyItems: PayslipPenaltyItem[];
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  currency: string;
  paymentStatus: 'UNPAID' | 'PAID';
  paidAt?: string;
  paymentReference?: string;
}
