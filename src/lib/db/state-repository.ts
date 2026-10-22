import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { AppDatabase } from './store';
import type { Branch, Mentor, Package, Student, Subject } from '../types/models';

const STATE_ID = 'lumentor';
const jsonState = (state: AppDatabase): Prisma.InputJsonValue => {
  const persisted = JSON.parse(JSON.stringify(state)) as AppDatabase;
  persisted.classcardConfig.apiKey = '';
  persisted.emailConfig.oauthClientSecret = '';
  persisted.emailConfig.oauthRefreshToken = '';
  return persisted as unknown as Prisma.InputJsonValue;
};

export async function loadAppState(): Promise<Partial<AppDatabase> | null> {
  const record = await prisma.appState.findUnique({ where: { id: STATE_ID } });
  return (record?.state as Partial<AppDatabase> | undefined) ?? null;
}

export async function saveAppState(state: AppDatabase): Promise<void> {
  await prisma.appState.upsert({
    where: { id: STATE_ID },
    create: { id: STATE_ID, state: jsonState(state) },
    update: { state: jsonState(state) },
  });
}

async function ensureOrganization() {
  const existing = await prisma.organization.findFirst({ select: { id: true } });
  if (existing) return existing.id;
  const organization = await prisma.organization.create({
    data: { name: 'LUmentor', code: 'LUMENTOR' },
    select: { id: true },
  });
  return organization.id;
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

async function ensureBranch(organizationId: string, branchId: string, state: AppDatabase) {
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
  state: AppDatabase
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
