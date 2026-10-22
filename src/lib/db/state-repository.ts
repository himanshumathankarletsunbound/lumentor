import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { AppDatabase } from './store';
import type { Branch, ClassEvent, Mentor, Package, Student, Subject } from '../types/models';
import type { UserRole } from '../types/auth';
import { SEED_ROLES } from './seedData';
import type { CurrentUser } from '../types/auth';

const STATE_ID = 'lumentor';
const jsonState = (state: AppDatabase): Prisma.InputJsonValue => {
  const persisted = JSON.parse(JSON.stringify(state)) as AppDatabase;
  persisted.classcardConfig.apiKey = '';
  persisted.emailConfig.oauthClientSecret = '';
  persisted.emailConfig.oauthRefreshToken = '';
  persisted.penaltyPolicies = persisted.penaltyPolicies ?? [];
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
    status: user.status as CurrentUser['status'],
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
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      systemRole: role.systemRole,
      description: role.description,
      permissions: Array.isArray(role.permissions) ? role.permissions as unknown as UserRole['permissions'] : [],
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    }));
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
      branchId: filters.branchId,
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
