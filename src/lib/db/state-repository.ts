import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { AppDatabase } from './store';
import type { Branch, ClassEvent, Mentor, Package, Student, Subject } from '../types/models';
import type { UserRole } from '../types/auth';
import { SEED_ROLES } from './seedData';
import type { CurrentUser } from '../types/auth';
import type { PayrollPlan, Penalty, PenaltyPolicy } from '../types/payroll';
import type { AuditEvent } from '../types/models';
import type { EmailConfig } from '../types/email';

async function ensureOrganization() {
  const existing = await prisma.organization.findFirst({ select: { id: true } });
  if (existing) return existing.id;
  const organization = await prisma.organization.create({
    data: { name: 'LUmentor', code: 'LUMENTOR', currency: 'INR' },
    select: { id: true },
  });
  return organization.id;
}

function toCurrentUser(user: {
  id: string;
  email: string;
  name: string;
  role: CurrentUser['role'];
  roleName: string | null;
  permissions: unknown;
  status: string;
  passwordHash: string;
  salt: string;
  sessionToken: string | null;
  sessionExpiry: Date | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
  mentorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleName: user.roleName || user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions as CurrentUser['permissions'] : [],
    status: user.status === 'SENT_PASSWORD_VERIFICATION' && user.passwordHash && !user.resetToken
      ? 'ACTIVE'
      : user.status as CurrentUser['status'],
    passwordHash: user.passwordHash,
    salt: user.salt,
    sessionToken: user.sessionToken || undefined,
    sessionExpiry: user.sessionExpiry?.toISOString(),
    resetToken: user.resetToken || undefined,
    resetTokenExpiry: user.resetTokenExpiry?.toISOString(),
    mentorId: user.mentorId || undefined,
    assignedBranchIds: [],
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<CurrentUser | undefined> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  return user ? toCurrentUser(user) : undefined;
}

export async function findUserById(id: string): Promise<CurrentUser | undefined> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toCurrentUser(user) : undefined;
}

export async function findUserBySessionToken(token: string): Promise<CurrentUser | undefined> {
  const user = await prisma.user.findUnique({ where: { sessionToken: token } });
  if (!user || !user.isActive || user.status !== 'ACTIVE') return undefined;
  if (user.sessionExpiry && user.sessionExpiry <= new Date()) return undefined;
  return toCurrentUser(user);
}

export async function findUserByResetToken(token: string): Promise<CurrentUser | undefined> {
  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  return user ? toCurrentUser(user) : undefined;
}

export async function saveUser(user: CurrentUser): Promise<CurrentUser> {
  const organizationId = await ensureOrganization();
  const saved = await prisma.user.upsert({
    where: { email: user.email.toLowerCase() },
    create: {
      id: user.id,
      organizationId,
      email: user.email.toLowerCase(),
      name: user.name,
      passwordHash: user.passwordHash || '',
      salt: user.salt || '',
      role: user.role,
      roleName: user.roleName,
      permissions: JSON.parse(JSON.stringify(user.permissions)) as Prisma.InputJsonValue,
      status: user.status || 'ACTIVE',
      isActive: user.status !== 'DISABLED',
      sessionToken: user.sessionToken,
      sessionExpiry: user.sessionExpiry ? new Date(user.sessionExpiry) : null,
      resetToken: user.resetToken,
      resetTokenExpiry: user.resetTokenExpiry ? new Date(user.resetTokenExpiry) : null,
      mentorId: user.mentorId,
    },
    update: {
      name: user.name,
      passwordHash: user.passwordHash || '',
      salt: user.salt || '',
      role: user.role,
      roleName: user.roleName,
      permissions: JSON.parse(JSON.stringify(user.permissions)) as Prisma.InputJsonValue,
      status: user.status || 'ACTIVE',
      isActive: user.status !== 'DISABLED',
      sessionToken: user.sessionToken,
      sessionExpiry: user.sessionExpiry ? new Date(user.sessionExpiry) : null,
      resetToken: user.resetToken,
      resetTokenExpiry: user.resetTokenExpiry ? new Date(user.resetTokenExpiry) : null,
      mentorId: user.mentorId,
    },
  });
  return toCurrentUser(saved);
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}

export async function listUsers(): Promise<CurrentUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return users.map(toCurrentUser);
}

export async function listRoles(): Promise<UserRole[]> {
  const roles = await prisma.role.findMany({ orderBy: { createdAt: 'asc' } });
  if (roles.length > 0) {
    const mappedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      systemRole: role.systemRole,
      description: role.description,
      permissions: Array.isArray(role.permissions) ? role.permissions as unknown as UserRole['permissions'] : [],
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    }));
    const seededRoles = SEED_ROLES.filter((seededRole) => !mappedRoles.some((role) => role.systemRole === seededRole.systemRole));
    return [...mappedRoles, ...seededRoles];
  }
  return process.env.DEMO_MODE === 'true' ? SEED_ROLES : [];
}

export async function createRole(role: Omit<UserRole, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserRole> {
  const created = await prisma.role.create({
    data: {
      name: role.name,
      systemRole: role.systemRole,
      description: role.description,
      permissions: JSON.parse(JSON.stringify(role.permissions)),
    },
  });
  return {
    id: created.id,
    name: created.name,
    systemRole: created.systemRole,
    description: created.description,
    permissions: created.permissions as unknown as UserRole['permissions'],
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function listMentors(branchId?: string): Promise<Mentor[]> {
  const mentors = await prisma.mentor.findMany({
    where: branchId && branchId !== 'ALL' ? { branchId } : undefined,
    include: { branch: true, user: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return mentors.map((mentor) => ({
    id: mentor.id,
    userId: mentor.user?.id,
    firstName: mentor.firstName,
    lastName: mentor.lastName,
    email: mentor.email,
    phone: mentor.phone || '',
    avatarUrl: mentor.avatarUrl || undefined,
    branchId: mentor.branchId,
    branchName: mentor.branch.name,
    subjectIds: [],
    payrollPlanId: mentor.payrollPlanId,
    status: mentor.status as Mentor['status'],
    externalId: mentor.externalId || undefined,
    provenance: mentor.provenance,
    teachingHoursThisMonth: mentor.teachingHoursThisMonth,
    completedClassesCount: mentor.completedClassesCount,
    attendanceRate: mentor.attendanceRate,
    createdAt: mentor.createdAt.toISOString(),
    updatedAt: mentor.updatedAt.toISOString(),
  }));
}

export interface MentorReviewRecord {
  id: string;
  mentorId: string;
  mentorName: string;
  branchName: string;
  reviewPeriod: string;
  auditScore: number | null;
  operationScore: number | null;
  totalScore: number | null;
  auditComments: string | null;
  operationComments: string | null;
  auditReviewerName: string | null;
  operationReviewerName: string | null;
  updatedAt: string;
}

export async function listMentorReviews(reviewPeriod?: string): Promise<MentorReviewRecord[]> {
  const reviews = await prisma.mentorReview.findMany({
    where: reviewPeriod ? { reviewPeriod } : undefined,
    include: {
      mentor: { include: { branch: true } },
      auditReviewer: { select: { name: true } },
      operationReviewer: { select: { name: true } },
    },
    orderBy: [{ totalScore: 'desc' }, { updatedAt: 'desc' }],
  });
  return reviews.map((review) => ({
    id: review.id,
    mentorId: review.mentorId,
    mentorName: `${review.mentor.firstName} ${review.mentor.lastName}`.trim(),
    branchName: review.mentor.branch.name,
    reviewPeriod: review.reviewPeriod,
    auditScore: review.auditScore === null ? null : Number(review.auditScore),
    operationScore: review.operationScore === null ? null : Number(review.operationScore),
    totalScore: review.totalScore === null ? null : Number(review.totalScore),
    auditComments: review.auditComments,
    operationComments: review.operationComments,
    auditReviewerName: review.auditReviewer?.name || null,
    operationReviewerName: review.operationReviewer?.name || null,
    updatedAt: review.updatedAt.toISOString(),
  }));
}

export async function getMentorReview(mentorId: string, reviewPeriod?: string): Promise<MentorReviewRecord | undefined> {
  const reviews = await listMentorReviews(reviewPeriod);
  return reviews.find((review) => review.mentorId === mentorId);
}

export async function upsertMentorReview(input: {
  mentorId: string;
  reviewPeriod: string;
  auditScore?: number | null;
  operationScore?: number | null;
  auditComments?: string | null;
  operationComments?: string | null;
  reviewerId: string;
  reviewerRole: 'AUDIT';
}): Promise<MentorReviewRecord> {
  const existing = await prisma.mentorReview.findUnique({
    where: { mentorId_reviewPeriod: { mentorId: input.mentorId, reviewPeriod: input.reviewPeriod } },
  });
  const score = (value: number | null | undefined, max: number, label: string) => {
    if (value === null || value === undefined) return undefined;
    if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} must be between 0 and ${max}.`);
    return Math.round(value * 100) / 100;
  };
  const auditScore = input.reviewerRole === 'AUDIT' ? score(input.auditScore, 3, 'Audit score') : undefined;
  const operationScore = score(input.operationScore, 2, 'Operations score');
  const nextAudit = auditScore !== undefined ? auditScore : existing?.auditScore === null || existing?.auditScore === undefined ? null : Number(existing.auditScore);
  const nextOperations = operationScore !== undefined ? operationScore : existing?.operationScore === null || existing?.operationScore === undefined ? null : Number(existing.operationScore);
  const totalScore = nextAudit === null || nextOperations === null ? null : Math.round((nextAudit + nextOperations) * 100) / 100;
  const review = await prisma.mentorReview.upsert({
    where: { mentorId_reviewPeriod: { mentorId: input.mentorId, reviewPeriod: input.reviewPeriod } },
    create: {
      mentorId: input.mentorId,
      reviewPeriod: input.reviewPeriod,
      auditScore: input.reviewerRole === 'AUDIT' ? auditScore : null,
      operationScore,
      totalScore,
      auditComments: input.auditComments || null,
      operationComments: input.operationComments || null,
      auditReviewerId: input.reviewerId,
      operationReviewerId: null,
    },
    update: {
      auditScore,
      operationScore,
      auditComments: input.auditComments || null,
      operationComments: input.operationComments || null,
      auditReviewerId: input.reviewerId,
      operationReviewerId: null,
      totalScore,
    },
    include: {
      mentor: { include: { branch: true } },
      auditReviewer: { select: { name: true } },
      operationReviewer: { select: { name: true } },
    },
  });
  return {
    id: review.id,
    mentorId: review.mentorId,
    mentorName: `${review.mentor.firstName} ${review.mentor.lastName}`.trim(),
    branchName: review.mentor.branch.name,
    reviewPeriod: review.reviewPeriod,
    auditScore: review.auditScore === null ? null : Number(review.auditScore),
    operationScore: review.operationScore === null ? null : Number(review.operationScore),
    totalScore: review.totalScore === null ? null : Number(review.totalScore),
    auditComments: review.auditComments,
    operationComments: review.operationComments,
    auditReviewerName: review.auditReviewer?.name || null,
    operationReviewerName: review.operationReviewer?.name || null,
    updatedAt: review.updatedAt.toISOString(),
  };
}

export async function listBranches(): Promise<Branch[]> {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address || '',
    city: branch.city || '',
    timezone: branch.timezone,
    phone: branch.phone || '',
    email: branch.email || '',
    isActive: branch.isActive,
    externalId: branch.externalId || undefined,
    provenance: branch.provenance,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
  }));
}

export async function createBranch(input: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Branch> {
  const organizationId = await ensureOrganization();
  const branch = await prisma.branch.create({
    data: { organizationId, name: input.name, code: input.code, address: input.address, city: input.city, timezone: input.timezone, phone: input.phone, email: input.email, isActive: input.isActive, provenance: input.provenance },
  });
  return {
    id: branch.id, name: branch.name, code: branch.code, address: branch.address || '', city: branch.city || '',
    timezone: branch.timezone, phone: branch.phone || '', email: branch.email || '', isActive: branch.isActive,
    externalId: branch.externalId || undefined, provenance: branch.provenance,
    createdAt: branch.createdAt.toISOString(), updatedAt: branch.updatedAt.toISOString(),
  };
}

export async function updateMentor(id: string, updates: Partial<Mentor>): Promise<Mentor> {
  const data = {
    branchId: updates.branchId,
    payrollPlanId: updates.payrollPlanId,
    status: updates.status,
    phone: updates.phone,
    firstName: updates.firstName,
    lastName: updates.lastName,
  };
  const mentor = await prisma.mentor.update({ where: { id }, data });
  return {
    id: mentor.id, firstName: mentor.firstName, lastName: mentor.lastName, email: mentor.email, phone: mentor.phone || '',
    branchId: mentor.branchId, branchName: '', subjectIds: [], payrollPlanId: mentor.payrollPlanId, status: mentor.status as Mentor['status'],
    externalId: mentor.externalId || undefined, provenance: mentor.provenance, teachingHoursThisMonth: mentor.teachingHoursThisMonth,
    completedClassesCount: mentor.completedClassesCount, attendanceRate: mentor.attendanceRate,
    createdAt: mentor.createdAt.toISOString(), updatedAt: mentor.updatedAt.toISOString(),
  };
}

export async function listSubjects(): Promise<Subject[]> {
  const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    category: subject.category,
    description: subject.description || '',
    defaultDurationMinutes: subject.defaultDurationMinutes,
    availableDurations: subject.availableDurations,
    isActive: subject.isActive,
    color: subject.color,
    externalId: subject.externalId || undefined,
    provenance: subject.provenance,
    createdAt: subject.createdAt.toISOString(),
    updatedAt: subject.updatedAt.toISOString(),
  }));
}

export async function listPackages(): Promise<Package[]> {
  const packages = await prisma.package.findMany({ orderBy: { name: 'asc' } });
  return packages.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    price: Number(item.price),
    currency: item.currency,
    totalSessions: item.totalSessions,
    validityDays: item.validityDays,
    subjectIds: [],
    branchIds: [],
    isActive: item.isActive,
    externalId: item.externalId || undefined,
    provenance: item.provenance,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
}

export async function listStudents(branchId?: string): Promise<Student[]> {
  const students = await prisma.student.findMany({
    where: branchId && branchId !== 'ALL' ? { branchId } : undefined,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return students.map((student) => ({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    phone: student.phone || '',
    branchId: student.branchId,
    dateOfBirth: student.dateOfBirth?.toISOString(),
    guardianName: student.guardianName || undefined,
    guardianEmail: student.guardianEmail || undefined,
    enrolledPackageIds: [],
    status: student.status as Student['status'],
    externalId: student.externalId || undefined,
    provenance: student.provenance,
    customFields: (student.customFields as Record<string, string> | null) || undefined,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
  }));
}

export async function listClasses(filters: {
  mentorId?: string;
  branchId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<ClassEvent[]> {
  const classes = await prisma.classEvent.findMany({
    where: {
      mentorId: filters.mentorId,
      branchId: filters.branchId && filters.branchId !== 'ALL' ? filters.branchId : undefined,
      status: filters.status && filters.status !== 'ALL' ? filters.status as never : undefined,
      startTime: filters.startDate || filters.endDate ? {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      } : undefined,
    },
    include: {
      branch: true,
      subject: true,
      mentor: true,
      attendances: { include: { student: true } },
    },
    orderBy: { startTime: 'desc' },
  });
  return classes.map((item) => {
    const statuses = item.attendances.map((attendance) => attendance.status);
    const summary: ClassEvent['attendanceStatusSummary'] =
      statuses.length === 0 || statuses.some((status) => status === 'UNMARKED')
        ? 'UNMARKED'
        : statuses.every((status) => status === 'PRESENT' || status === 'LATE')
        ? 'ALL_PRESENT'
        : statuses.every((status) => status === 'ABSENT' || status === 'ABSENT_BILLABLE')
        ? 'ALL_ABSENT'
        : 'PARTIAL';
    return {
      id: item.id,
      title: item.title,
      subjectId: item.subjectId,
      subjectName: item.subject.name,
      mentorId: item.mentorId,
      mentorName: `${item.mentor.firstName} ${item.mentor.lastName}`,
      branchId: item.branchId,
      branchName: item.branch.name,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
      durationMinutes: item.durationMinutes,
      isGroup: item.isGroup,
      capacity: item.capacity,
      students: item.attendances.map((attendance) => ({
        studentId: attendance.studentId,
        studentName: `${attendance.student.firstName} ${attendance.student.lastName}`,
        studentEmail: attendance.student.email,
        attendanceStatus: attendance.status,
        markedAt: attendance.markedAt?.toISOString(),
        markedBy: attendance.markedBy || undefined,
        notes: attendance.notes || undefined,
      })),
      status: item.status,
      attendanceStatusSummary: summary,
      cancellationReason: item.cancellationReason || undefined,
      cancelledAt: item.cancelledAt?.toISOString(),
      cancelledBy: item.cancelledBy || undefined,
      isLateCancellation: item.isLateCancellation,
      room: item.room || undefined,
      meetingLink: item.meetingLink || undefined,
      externalId: item.externalId || undefined,
      provenance: item.provenance,
      notes: item.notes || undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  });
}

export async function listPayrollPlans(): Promise<PayrollPlan[]> {
  const plans = await prisma.payrollPlan.findMany({ orderBy: { name: 'asc' } });
  return plans.map((plan) => ({
    id: plan.id, name: plan.name, code: plan.code, description: plan.description || '',
    compensationModel: plan.compensationModel, currency: plan.currency,
    baseSalary: Number(plan.baseSalary), defaultClassRate: Number(plan.defaultClassRate),
    hourlyRate: Number(plan.hourlyRate), perStudentRate: Number(plan.perStudentRate),
    revenuePercentage: Number(plan.revenuePercentage), minEligibleDurationMinutes: plan.minEligibleDurationMinutes,
    payableClassStatuses: plan.payableClassStatuses, lateCancellationPayPercent: Number(plan.lateCancellationPayPercent),
    groupMultiplier: Number(plan.groupMultiplier), subjectRates: (plan.subjectRates as Record<string, number> | null) || undefined,
    branchRates: (plan.branchRates as Record<string, number> | null) || undefined, formula: plan.formula || undefined,
    version: plan.version, effectiveFrom: plan.effectiveFrom.toISOString(), effectiveTo: plan.effectiveTo?.toISOString(),
    isActive: plan.isActive, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(),
  }));
}

export async function createPayrollPlan(input: Omit<PayrollPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<PayrollPlan> {
  const organizationId = await ensureOrganization();
  const plan = await prisma.payrollPlan.create({
    data: {
      organizationId, name: input.name, code: input.code, description: input.description,
      compensationModel: input.compensationModel, currency: input.currency || 'INR',
      baseSalary: input.baseSalary, defaultClassRate: input.defaultClassRate, hourlyRate: input.hourlyRate,
      perStudentRate: input.perStudentRate, revenuePercentage: input.revenuePercentage,
      minEligibleDurationMinutes: input.minEligibleDurationMinutes, payableClassStatuses: input.payableClassStatuses,
      lateCancellationPayPercent: input.lateCancellationPayPercent, groupMultiplier: input.groupMultiplier,
      subjectRates: input.subjectRates, branchRates: input.branchRates, formula: input.formula,
      version: input.version, effectiveFrom: new Date(input.effectiveFrom), effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
      isActive: input.isActive,
    },
  });
  return (await listPayrollPlans()).find((item) => item.id === plan.id)!;
}

export async function updatePayrollPlan(id: string, updates: Partial<PayrollPlan>): Promise<PayrollPlan> {
  await prisma.payrollPlan.update({
    where: { id },
    data: {
      name: updates.name, code: updates.code, description: updates.description,
      compensationModel: updates.compensationModel, currency: updates.currency,
      baseSalary: updates.baseSalary, defaultClassRate: updates.defaultClassRate, hourlyRate: updates.hourlyRate,
      perStudentRate: updates.perStudentRate, revenuePercentage: updates.revenuePercentage,
      minEligibleDurationMinutes: updates.minEligibleDurationMinutes, lateCancellationPayPercent: updates.lateCancellationPayPercent,
      groupMultiplier: updates.groupMultiplier, formula: updates.formula, isActive: updates.isActive,
      version: updates.version, effectiveTo: updates.effectiveTo ? new Date(updates.effectiveTo) : undefined,
    },
  });
  return (await listPayrollPlans()).find((item) => item.id === id)!;
}

export async function deletePayrollPlan(id: string): Promise<void> {
  await prisma.payrollPlan.delete({ where: { id } });
}

function mapPenalty(item: Prisma.PenaltyGetPayload<{ include: { mentor: true; branch: true } }>): Penalty {
  return {
    id: item.id, mentorId: item.mentorId, mentorName: `${item.mentor.firstName} ${item.mentor.lastName}`,
    classId: item.classId || undefined, branchId: item.branchId, branchName: item.branch.name,
    category: item.category, reason: item.reason, amount: Number(item.amount), evidenceNote: item.evidenceNote || undefined,
    evidenceUrl: item.evidenceUrl || undefined, createdBy: item.createdBy, createdByName: item.createdBy,
    createdAt: item.createdAt.toISOString(), status: item.status, approvedBy: item.approvedBy || undefined,
    approvedAt: item.approvedAt?.toISOString(), rejectionReason: item.rejectionReason || undefined,
    appliedPayrollBatchId: item.appliedPayrollBatchId || undefined, appliedAt: item.appliedAt?.toISOString(),
    reversedBy: item.reversedBy || undefined, reversedAt: item.reversedAt?.toISOString(),
    reversalReason: item.reversalReason || undefined, disputeStatus: (item.disputeStatus || 'NONE') as Penalty['disputeStatus'],
    disputeNote: item.disputeNote || undefined,
  };
}

export async function listPenalties(mentorId?: string): Promise<Penalty[]> {
  const rows = await prisma.penalty.findMany({
    where: mentorId ? { mentorId } : undefined, include: { mentor: true, branch: true }, orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapPenalty);
}

export async function createPenalty(input: { mentorId: string; branchId: string; classId?: string; category: string; reason: string; amount: number; evidenceNote?: string; evidenceUrl?: string; createdBy: string }): Promise<Penalty> {
  const row = await prisma.penalty.create({ data: {
    mentorId: input.mentorId, branchId: input.branchId, classId: input.classId, category: input.category as never,
    reason: input.reason, amount: input.amount, evidenceNote: input.evidenceNote, evidenceUrl: input.evidenceUrl,
    createdBy: input.createdBy, status: 'SUBMITTED',
  }, include: { mentor: true, branch: true } });
  return mapPenalty(row);
}

export async function listPenaltyPolicies(): Promise<PenaltyPolicy[]> {
  const rows = await prisma.penaltyPolicy.findMany({ orderBy: { name: 'asc' } });
  return rows.map((row) => ({ id: row.id, code: row.code || undefined, name: row.name, description: row.description || '', deductionType: row.deductionType as PenaltyPolicy['deductionType'], rateValue: Number(row.rateValue), defaultAmount: Number(row.defaultAmount), isActive: row.isActive, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
}

export async function createPenaltyPolicy(input: Omit<PenaltyPolicy, 'createdAt' | 'updatedAt'>): Promise<PenaltyPolicy> {
  await prisma.penaltyPolicy.create({ data: { id: input.id, code: input.code, name: input.name, description: input.description, deductionType: input.deductionType || 'FIXED_AMOUNT', rateValue: input.rateValue || 0, defaultAmount: input.defaultAmount, isActive: input.isActive } });
  return (await listPenaltyPolicies()).find((item) => item.id === input.id)!;
}

export async function updatePenaltyPolicy(id: string, updates: Partial<PenaltyPolicy>): Promise<PenaltyPolicy> {
  await prisma.penaltyPolicy.update({ where: { id }, data: { name: updates.name, description: updates.description, deductionType: updates.deductionType, rateValue: updates.rateValue, defaultAmount: updates.defaultAmount, isActive: updates.isActive } });
  return (await listPenaltyPolicies()).find((item) => item.id === id)!;
}

export async function deletePenaltyPolicy(id: string): Promise<void> {
  await prisma.penaltyPolicy.delete({ where: { id } });
}

export async function listAuditEvents(limit = 50): Promise<AuditEvent[]> {
  const rows = await prisma.auditEvent.findMany({ orderBy: { timestamp: 'desc' }, take: limit, include: { user: true } });
  return rows.map((row) => ({ id: row.id, timestamp: row.timestamp.toISOString(), userId: row.userId, userName: row.user.name, userRole: row.user.role, action: row.action, entityType: row.entityType, entityId: row.entityId, details: row.details, ipAddress: row.ipAddress || undefined, branchId: row.branchId || undefined }));
}

export async function createAuditEvent(input: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
  await prisma.auditEvent.create({ data: { userId: input.userId, action: input.action, entityType: input.entityType, entityId: input.entityId, details: input.details, ipAddress: input.ipAddress, branchId: input.branchId } });
}

export async function listCustomFields(entityType?: string) {
  const rows = await prisma.customFieldDefinition.findMany({ where: entityType ? { entityType } : undefined, orderBy: { name: 'asc' } });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), options: row.options as string[] | undefined }));
}

export async function createCustomField(input: { name: string; key: string; entityType: string; fieldType: string; classcardFieldKey?: string; classcardEndpoint?: string; isRequired: boolean; options?: string[]; defaultValue?: string; description?: string; isActive?: boolean }) {
  const row = await prisma.customFieldDefinition.create({ data: input });
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), options: row.options as string[] | undefined };
}

export async function deleteCustomField(id: string): Promise<boolean> {
  const result = await prisma.customFieldDefinition.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function getPersistedEmailConfig(): Promise<Partial<EmailConfig>> {
  const { getEncryptedSecret } = await import('./secure-storage');
  const value = await getEncryptedSecret('email.config');
  return value ? JSON.parse(value) as Partial<EmailConfig> : {};
}

export async function savePersistedEmailConfig(config: Partial<EmailConfig>): Promise<void> {
  const { setEncryptedSecret } = await import('./secure-storage');
  await setEncryptedSecret('email.config', JSON.stringify(config));
}

export async function getOrganizationSettings() {
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    return {
      orgName: 'LUmentor Educational Services',
      currency: 'INR',
      timezone: 'America/New_York',
      cutoffDay: 15,
    };
  }
  return {
    orgName: organization.name,
    currency: organization.currency || 'INR',
    timezone: organization.timezone,
    cutoffDay: 15,
  };
}

export async function updateOrganizationSettings(input: { orgName?: string; currency: string; timezone: string; cutoffDay?: number }) {
  const id = await ensureOrganization();
  const organization = await prisma.organization.update({ where: { id }, data: { name: input.orgName || undefined, currency: input.currency, timezone: input.timezone } });
  return { orgName: organization.name, currency: organization.currency, timezone: organization.timezone, cutoffDay: 15 };
}

export async function getSyncBranchId(): Promise<string> {
  const branch = await prisma.branch.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!branch) throw new Error('Create an active branch before running Classcard synchronization.');
  return branch.id;
}

export async function upsertClasscardStudent(input: {
  externalId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
}): Promise<'created' | 'updated'> {
  const existing = await prisma.student.findFirst({
    where: { OR: [{ externalId: input.externalId }, { email: input.email }] },
    select: { id: true },
  });
  const data = {
    branchId: input.branchId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone || null,
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    externalId: input.externalId || null,
    provenance: 'CLASSCARD_SOURCED' as const,
  };
  if (existing) {
    await prisma.student.update({ where: { id: existing.id }, data });
    return 'updated';
  }
  await prisma.student.create({ data });
  return 'created';
}

export async function upsertClasscardSubject(input: {
  externalId: string;
  name: string;
  code: string;
  category: string;
  description: string;
  defaultDurationMinutes: number;
}): Promise<'created' | 'updated'> {
  const existing = await prisma.subject.findFirst({
    where: { OR: [{ externalId: input.externalId }, { name: input.name }] },
    select: { id: true },
  });
  const data = {
    name: input.name,
    code: input.code,
    category: input.category,
    description: input.description,
    defaultDurationMinutes: input.defaultDurationMinutes,
    availableDurations: [30, 45, 60, 90],
    isActive: true,
    color: '#06b6d4',
    externalId: input.externalId || null,
    provenance: 'CLASSCARD_SOURCED' as const,
  };
  if (existing) {
    await prisma.subject.update({ where: { id: existing.id }, data });
    return 'updated';
  }
  await prisma.subject.create({ data });
  return 'created';
}

export async function listStudentExternalIds(): Promise<Array<{ id: string; externalId: string | null; firstName: string; lastName: string }>> {
    return prisma.student.findMany({ select: { id: true, externalId: true, firstName: true, lastName: true } });
  }

  export async function upsertClasscardInvoice(input: {
    externalId: string;
    invoiceNumber: string;
    branchId: string;
    studentId: string;
    issueDate: string;
    dueDate: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
  }): Promise<'created' | 'updated'> {
    const existing = await prisma.invoice.findFirst({
      where: { OR: [{ externalId: input.externalId }, { invoiceNumber: input.invoiceNumber }] },
      select: { id: true },
    });
    const data = {
      invoiceNumber: input.invoiceNumber,
      branchId: input.branchId,
      studentId: input.studentId,
      issueDate: new Date(input.issueDate),
      dueDate: new Date(input.dueDate),
      totalAmount: input.totalAmount,
      paidAmount: input.paidAmount,
      currency: 'INR',
      status: input.status,
      externalId: input.externalId || null,
      provenance: 'CLASSCARD_SOURCED' as const,
    };
    if (existing) {
      await prisma.invoice.update({ where: { id: existing.id }, data });
      return 'updated';
    }
    await prisma.invoice.create({ data });
    return 'created';
  }

  export async function upsertClasscardPayment(input: {
    externalId: string;
    invoiceId: string;
    paymentNumber: string;
    amount: number;
    paymentDate: string;
    method: string;
  }): Promise<'created' | 'updated'> {
    const invoice = await prisma.invoice.findFirst({
      where: { OR: [{ id: input.invoiceId }, { externalId: input.invoiceId }] },
      select: { id: true },
    });
    if (!invoice) throw new Error(`Payment ${input.externalId} references an unknown invoice ${input.invoiceId}.`);
    const existing = await prisma.payment.findFirst({ where: { externalId: input.externalId }, select: { id: true } });
    const data = {
      invoiceId: invoice.id,
      paymentNumber: input.paymentNumber,
      amount: input.amount,
      paymentDate: new Date(input.paymentDate),
      method: input.method,
      status: 'SUCCESS',
      externalId: input.externalId || null,
      provenance: 'CLASSCARD_SOURCED' as const,
    };
    if (existing) {
      await prisma.payment.update({ where: { id: existing.id }, data });
      return 'updated';
    }
    await prisma.payment.create({ data });
    return 'created';
  }

export async function createSyncJobRecord(input: {
  id: string;
  jobType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage?: string;
  logSummary: string[];
}): Promise<void> {
  await prisma.syncJob.create({
    data: {
      id: input.id,
      jobType: input.jobType,
      status: input.status,
      startedAt: new Date(input.startedAt),
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      recordsProcessed: input.recordsProcessed,
      recordsCreated: input.recordsCreated,
      recordsUpdated: input.recordsUpdated,
      recordsFailed: input.recordsFailed,
      errorMessage: input.errorMessage,
      logSummary: input.logSummary,
    },
  });
}

export async function listDashboardFinance() {
  const [batches, payslips, invoices, payments, syncJobs, auditLogs] = await Promise.all([
    prisma.payrollBatch.findMany({ orderBy: { createdAt: 'desc' }, include: { lineItems: { include: { mentor: true } } } }),
    prisma.payslip.findMany({ orderBy: { generatedAt: 'desc' } }),
    prisma.invoice.findMany({ orderBy: { issueDate: 'desc' } }),
    prisma.payment.findMany({ orderBy: { paymentDate: 'desc' } }),
    prisma.syncJob.findMany({ orderBy: { startedAt: 'desc' } }),
    listAuditEvents(10),
  ]);
  return {
    batches: batches.map((batch) => ({ ...batch, totalGross: Number(batch.totalGross), totalPenalties: Number(batch.totalPenalties), totalAdjustments: Number(batch.totalAdjustments), totalNet: Number(batch.totalNet), currency: batch.currency, startDate: batch.startDate.toISOString(), endDate: batch.endDate.toISOString(), createdAt: batch.createdAt.toISOString(), updatedAt: batch.updatedAt.toISOString(), lineItems: batch.lineItems.map((item) => ({ ...item, mentorName: `${item.mentor.firstName} ${item.mentor.lastName}`, mentorEmail: item.mentor.email, baseSalaryAmount: Number(item.baseSalaryAmount), classEarnings: Number(item.classEarnings), durationEarnings: Number(item.durationEarnings), studentEarnings: Number(item.studentEarnings), revenueShareEarnings: Number(item.revenueShareEarnings), bonusAmount: Number(item.bonusAmount), penaltyDeductions: Number(item.penaltyDeductions), grossEarnings: Number(item.grossEarnings), netPayable: Number(item.netPayable) })) })),
    payslips: payslips.map((slip) => ({ ...slip, grossEarnings: Number(slip.grossEarnings), totalDeductions: Number(slip.totalDeductions), netPayable: Number(slip.netPayable), startDate: slip.startDate.toISOString(), endDate: slip.endDate.toISOString(), generatedAt: slip.generatedAt.toISOString() })),
    invoices: invoices.map((invoice) => ({ ...invoice, totalAmount: Number(invoice.totalAmount), paidAmount: Number(invoice.paidAmount), issueDate: invoice.issueDate.toISOString(), dueDate: invoice.dueDate.toISOString(), createdAt: invoice.createdAt.toISOString() })),
    payments: payments.map((payment) => ({ ...payment, amount: Number(payment.amount), paymentDate: payment.paymentDate.toISOString(), createdAt: payment.createdAt.toISOString() })),
    syncJobs: syncJobs.map((job) => ({ ...job, startedAt: job.startedAt.toISOString(), completedAt: job.completedAt?.toISOString() })),
    auditLogs,
  };
}

export async function updatePayrollBatchStatus(input: { id: string; status: 'DRAFT' | 'SUBMITTED' | 'APPROVED'; userId?: string; paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID' }): Promise<Record<string, unknown>> {
  const batch = await prisma.payrollBatch.update({
    where: { id: input.id },
    data: {
      status: input.status,
      submittedBy: input.status === 'SUBMITTED' ? input.userId : undefined,
      submittedAt: input.status === 'SUBMITTED' ? new Date() : undefined,
      approvedBy: input.status === 'APPROVED' ? input.userId : undefined,
      approvedAt: input.status === 'APPROVED' ? new Date() : undefined,
      paymentStatus: input.paymentStatus,
    },
  });
  return { ...batch, totalGross: Number(batch.totalGross), totalPenalties: Number(batch.totalPenalties), totalAdjustments: Number(batch.totalAdjustments), totalNet: Number(batch.totalNet), startDate: batch.startDate.toISOString(), endDate: batch.endDate.toISOString(), createdAt: batch.createdAt.toISOString(), updatedAt: batch.updatedAt.toISOString() };
}

export async function listPayslips(mentorId?: string) {
  const rows = await prisma.payslip.findMany({ where: mentorId ? { mentorId } : undefined, orderBy: { generatedAt: 'desc' } });
  return rows.map((row) => ({
    ...row,
    grossEarnings: Number(row.grossEarnings), totalDeductions: Number(row.totalDeductions), netPayable: Number(row.netPayable),
    startDate: row.startDate.toISOString(), endDate: row.endDate.toISOString(), generatedAt: row.generatedAt.toISOString(),
    paidAt: row.paidAt?.toISOString(),
  }));
}

export async function createAdjustment(input: { mentorId: string; type: string; reason: string; amount: number; approvedBy: string }) {
  const row = await prisma.adjustment.create({ data: input });
  return { ...row, amount: Number(row.amount), createdAt: row.createdAt.toISOString() };
}

export async function markPayrollBatchPaid(id: string, paymentReference: string) {
  const paidAt = new Date();
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.payrollBatch.update({ where: { id }, data: { paymentStatus: 'PAID', paidAt, paymentReference } });
    await transaction.payslip.updateMany({ where: { batchId: id }, data: { paymentStatus: 'PAID', paidAt, paymentReference } });
    return { ...batch, totalGross: Number(batch.totalGross), totalPenalties: Number(batch.totalPenalties), totalAdjustments: Number(batch.totalAdjustments), totalNet: Number(batch.totalNet), paidAt: paidAt.toISOString() };
  });
}

type ClassWriteInput = {
  id?: string;
  title: string;
  subjectId: string;
  branchId: string;
  mentorId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isGroup: boolean;
  capacity: number;
  room?: string;
  meetingLink?: string;
  notes?: string;
  status?: ClassEvent['status'];
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  isLateCancellation?: boolean;
  provenance?: ClassEvent['provenance'];
  studentIds: string[];
};

export async function createNormalizedClass(input: ClassWriteInput): Promise<ClassEvent> {
  const created = await prisma.classEvent.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      title: input.title,
      subjectId: input.subjectId,
      branchId: input.branchId,
      mentorId: input.mentorId,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      durationMinutes: input.durationMinutes,
      isGroup: input.isGroup,
      capacity: input.capacity,
      room: input.room,
      meetingLink: input.meetingLink,
      notes: input.notes,
      status: input.status ?? 'SCHEDULED',
      cancellationReason: input.cancellationReason,
      cancelledAt: input.cancelledAt ? new Date(input.cancelledAt) : undefined,
      cancelledBy: input.cancelledBy,
      isLateCancellation: input.isLateCancellation ?? false,
      provenance: input.provenance ?? 'LOCALLY_CREATED',
      attendances: input.studentIds.length > 0
        ? { create: input.studentIds.map((studentId) => ({ studentId, status: 'UNMARKED' })) }
        : undefined,
    },
  });
  const classes = await listClasses({ startDate: created.startTime.toISOString(), endDate: created.startTime.toISOString() });
  const result = classes.find((item) => item.id === created.id);
  if (!result) throw new Error('The newly created class could not be reloaded from PostgreSQL.');
  return result;
}

export async function updateNormalizedClass(
  id: string,
  updates: {
    status?: ClassEvent['status'];
    cancellationReason?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    notes?: string;
    room?: string;
    meetingLink?: string;
    isLateCancellation?: boolean;
  }
): Promise<ClassEvent> {
  const updated = await prisma.classEvent.update({
    where: { id },
    data: {
      status: updates.status,
      cancellationReason: updates.cancellationReason,
      cancelledAt: updates.cancelledAt ? new Date(updates.cancelledAt) : undefined,
      cancelledBy: updates.cancelledBy,
      notes: updates.notes,
      room: updates.room,
      meetingLink: updates.meetingLink,
      isLateCancellation: updates.isLateCancellation,
    },
  });
  const classes = await listClasses({ startDate: updated.startTime.toISOString(), endDate: updated.startTime.toISOString() });
  const result = classes.find((item) => item.id === id);
  if (!result) throw new Error('The updated class could not be reloaded from PostgreSQL.');
  return result;
}

export async function recordNormalizedAttendance(
  classId: string,
  roster: Array<{ studentId: string; attendanceStatus: 'PRESENT' | 'ABSENT' | 'ABSENT_BILLABLE' | 'LATE' | 'EXCUSED' | 'UNMARKED'; notes?: string }>,
  markedBy: string
): Promise<ClassEvent> {
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    for (const student of roster) {
      await transaction.classAttendance.upsert({
        where: { classEventId_studentId: { classEventId: classId, studentId: student.studentId } },
        create: {
          classEventId: classId,
          studentId: student.studentId,
          status: student.attendanceStatus,
          notes: student.notes,
          markedAt: student.attendanceStatus === 'UNMARKED' ? null : now,
          markedBy: student.attendanceStatus === 'UNMARKED' ? null : markedBy,
        },
        update: {
          status: student.attendanceStatus,
          notes: student.notes,
          markedAt: student.attendanceStatus === 'UNMARKED' ? null : now,
          markedBy: student.attendanceStatus === 'UNMARKED' ? null : markedBy,
        },
      });
    }
    const statuses = roster.map((student) => student.attendanceStatus);
    const complete = statuses.length > 0 && statuses.every((status) => status !== 'UNMARKED');
    await transaction.classEvent.update({
      where: { id: classId },
      data: complete && statuses.some((status) => status === 'PRESENT' || status === 'LATE') ? { status: 'COMPLETED' } : {},
    });
  });
  const classes = await listClasses();
  const result = classes.find((item) => item.id === classId);
  if (!result) throw new Error('The class attendance was saved but the class could not be reloaded.');
  return result;
}

export async function listAttendanceSummaries(filters?: {
  reportType?: 'BY_CLASS' | 'BY_SUBJECT';
  studentId?: string;
  subjectId?: string;
  from?: string;
  to?: string;
}) {
  const rows = await prisma.attendanceSummary.findMany({
    where: {
      reportType: filters?.reportType,
      studentId: filters?.studentId,
      subjectId: filters?.subjectId,
      attendanceDate: filters?.from || filters?.to ? {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      } : undefined,
    },
    orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    reportType: row.reportType as 'BY_CLASS' | 'BY_SUBJECT',
    studentId: row.studentId || undefined,
    subjectId: row.subjectId || undefined,
    studentName: row.studentName || undefined,
    studentExternalId: row.studentExternalId || undefined,
    subjectName: row.subjectName || undefined,
    className: row.className || undefined,
    attendanceDate: row.attendanceDate?.toISOString(),
    timeRange: row.timeRange || undefined,
    location: row.location || undefined,
    staffName: row.staffName || undefined,
    enrolled: row.enrolled,
    present: row.present,
    absent: row.absent,
    attendancePercentage: row.attendancePercentage ?? undefined,
    sourceFile: row.sourceFile,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function ensurePayrollPlan(organizationId: string, id: string) {
  const existing = await prisma.payrollPlan.findUnique({ where: { id }, select: { id: true } });
  if (existing) return existing.id;
  const plan = await prisma.payrollPlan.create({
    data: {
      id,
      organizationId,
      name: 'Default Plan',
      code: `DEFAULT-${id.slice(-8)}`,
      compensationModel: 'PER_CLASS',
      effectiveFrom: new Date(),
    },
    select: { id: true },
  });
  return plan.id;
}

async function ensureBranch(organizationId: string, branchId: string, state: Pick<AppDatabase, 'branches'>) {
  const branch = state.branches.find((item) => item.id === branchId);
  if (!branch) throw new Error(`Branch ${branchId} must exist before creating a related record.`);
  await prisma.branch.upsert({
    where: { id: branch.id },
    create: { id: branch.id, organizationId, name: branch.name, code: branch.code, address: branch.address, city: branch.city, timezone: branch.timezone, phone: branch.phone, email: branch.email, isActive: branch.isActive, provenance: branch.provenance },
    update: { name: branch.name, code: branch.code, address: branch.address, city: branch.city, timezone: branch.timezone, phone: branch.phone, email: branch.email, isActive: branch.isActive, provenance: branch.provenance },
  });
}

export async function saveNormalizedRecord(
  type: 'branch' | 'subject' | 'package' | 'student' | 'mentor',
  record: Branch | Subject | Package | Student | Mentor,
  state: Pick<AppDatabase, 'branches'>
): Promise<void> {
  const organizationId = await ensureOrganization();
  if (type === 'branch') {
    const branch = record as Branch;
    await prisma.branch.upsert({
      where: { id: branch.id },
      create: { id: branch.id, organizationId, name: branch.name, code: branch.code, address: branch.address, city: branch.city, timezone: branch.timezone, phone: branch.phone, email: branch.email, isActive: branch.isActive, provenance: branch.provenance },
      update: { name: branch.name, code: branch.code, address: branch.address, city: branch.city, timezone: branch.timezone, phone: branch.phone, email: branch.email, isActive: branch.isActive, provenance: branch.provenance },
    });
  } else if (type === 'subject') {
    const subject = record as Subject;
    await prisma.subject.upsert({
      where: { id: subject.id },
      create: { id: subject.id, name: subject.name, code: subject.code, category: subject.category, description: subject.description, defaultDurationMinutes: subject.defaultDurationMinutes, availableDurations: subject.availableDurations, isActive: subject.isActive, color: subject.color, provenance: subject.provenance },
      update: { name: subject.name, code: subject.code, category: subject.category, description: subject.description, defaultDurationMinutes: subject.defaultDurationMinutes, availableDurations: subject.availableDurations, isActive: subject.isActive, color: subject.color, provenance: subject.provenance },
    });
  } else if (type === 'package') {
    const pkg = record as Package;
    await prisma.package.upsert({
      where: { id: pkg.id },
      create: { id: pkg.id, name: pkg.name, code: pkg.code, price: pkg.price, currency: pkg.currency, totalSessions: pkg.totalSessions, validityDays: pkg.validityDays, isActive: pkg.isActive, provenance: pkg.provenance },
      update: { name: pkg.name, code: pkg.code, price: pkg.price, currency: pkg.currency, totalSessions: pkg.totalSessions, validityDays: pkg.validityDays, isActive: pkg.isActive, provenance: pkg.provenance },
    });
  } else if (type === 'student') {
    const student = record as Student;
    if (!student.branchId) throw new Error('A campus branch is required before creating a student.');
    await ensureBranch(organizationId, student.branchId, state);
    await prisma.student.upsert({
      where: { id: student.id },
      create: { id: student.id, branchId: student.branchId, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone, dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth) : undefined, guardianName: student.guardianName, guardianEmail: student.guardianEmail, status: student.status, customFields: student.customFields, provenance: student.provenance },
      update: { branchId: student.branchId, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone, status: student.status, customFields: student.customFields, provenance: student.provenance },
    });
  } else {
    const mentor = record as Mentor;
    if (!mentor.branchId || !mentor.payrollPlanId) throw new Error('A campus branch and payroll plan are required before creating a mentor.');
    await ensureBranch(organizationId, mentor.branchId, state);
    const payrollPlanId = await ensurePayrollPlan(organizationId, mentor.payrollPlanId);
    await prisma.mentor.upsert({
      where: { id: mentor.id },
      create: { id: mentor.id, branchId: mentor.branchId, firstName: mentor.firstName, lastName: mentor.lastName, email: mentor.email, phone: mentor.phone, payrollPlanId, status: mentor.status, provenance: mentor.provenance, teachingHoursThisMonth: mentor.teachingHoursThisMonth, completedClassesCount: mentor.completedClassesCount, attendanceRate: mentor.attendanceRate },
      update: { branchId: mentor.branchId, firstName: mentor.firstName, lastName: mentor.lastName, email: mentor.email, phone: mentor.phone, payrollPlanId, status: mentor.status, provenance: mentor.provenance },
    });
  }
}

export async function deleteNormalizedRecord(
  type: 'branch' | 'subject' | 'package' | 'student' | 'mentor',
  id: string
): Promise<void> {
  try {
    if (type === 'branch') {
      await prisma.branch.delete({ where: { id } }).catch(() => {});
    } else if (type === 'subject') {
      await prisma.subject.delete({ where: { id } }).catch(() => {});
    } else if (type === 'package') {
      await prisma.package.delete({ where: { id } }).catch(() => {});
    } else if (type === 'student') {
      await prisma.student.delete({ where: { id } }).catch(() => {});
    } else if (type === 'mentor') {
      await prisma.mentor.delete({ where: { id } }).catch(() => {});
    }

  } catch (error) {
    console.warn(`Could not delete normalized ${type} with id ${id} from Prisma:`, error);
  }
}
