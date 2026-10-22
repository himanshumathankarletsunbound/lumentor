import {
  Branch,
  Subject,
  Package,
  Student,
  Mentor,
  ClassEvent,
  Invoice,
  Payment,
  AuditEvent,
  CustomFieldDefinition,
  CustomFieldEntityType,
} from '../types/models';
import {
  PayrollPlan,
  Penalty,
  Adjustment,
  PayrollPeriod,
  PayrollBatch,
  Payslip,
} from '../types/payroll';
import { UserRole, CurrentUser } from '../types/auth';
import { ClasscardConfig, ClasscardEndpointInfo, SyncJob } from '../types/classcard';
import {
  SEED_ROLES,
  SEED_USERS,
  SEED_BRANCHES,
  SEED_SUBJECTS,
  SEED_PACKAGES,
  SEED_PAYROLL_PLANS,
  SEED_MENTORS,
  SEED_STUDENTS,
  SEED_CLASSES,
  SEED_PENALTIES,
  SEED_ADJUSTMENTS,
  SEED_PAYROLL_PERIODS,
  SEED_PAYSLIPS,
  SEED_INVOICES,
  SEED_PAYMENTS,
  SEED_AUDIT_LOGS,
  INITIAL_CLASSCARD_CONFIG,
  CLASSCARD_ENDPOINTS_REGISTRY,
  SEED_SYNC_JOBS,
  SEED_CUSTOM_FIELDS,
  INITIAL_EMAIL_CONFIG,
  INITIAL_ORG_SETTINGS,
} from './seedData';
import { EmailConfig, OrganizationSettings } from '../types/email';

type PostgresRepository = typeof import('./state-repository');

declare global {
  var lumentorPostgresRepository: PostgresRepository | undefined;
}

export interface AppDatabase {
  roles: UserRole[];
  users: CurrentUser[];
  branches: Branch[];
  subjects: Subject[];
  packages: Package[];
  payrollPlans: PayrollPlan[];
  mentors: Mentor[];
  students: Student[];
  classes: ClassEvent[];
  penalties: Penalty[];
  adjustments: Adjustment[];
  payrollPeriods: PayrollPeriod[];
  payrollBatches: PayrollBatch[];
  payslips: Payslip[];
  invoices: Invoice[];
  payments: Payment[];
  auditLogs: AuditEvent[];
  classcardConfig: ClasscardConfig;
  classcardEndpoints: ClasscardEndpointInfo[];
  syncJobs: SyncJob[];
  customFields: CustomFieldDefinition[];
  emailConfig: EmailConfig;
  orgSettings: OrganizationSettings;
}

function getNodeFsAndPath() {
  if (typeof window === 'undefined') {
    try {
      const g = globalThis as unknown as { require?: (mod: string) => unknown };
      const req = typeof g.require === 'function' ? g.require : eval('require');
      return {
        fs: req('fs'),
        path: req('path'),
        require: req,
      };
    } catch {
      return null;
    }
  }
  return null;
}

class DataStore {
  private data: AppDatabase;
  private initialized = false;
  private lastMtime = 0;
  private persistenceReady: Promise<void> = Promise.resolve();
  private persistenceQueue: Promise<void> = Promise.resolve();
  private postgresLoadStarted = false;
  private postgresLoadError: unknown;

  constructor() {
    this.data = this.getDefaultState();
    if (this.usesPostgres()) {
      // PostgreSQL is loaded lazily after Next.js server instrumentation registers
      // the repository. Module evaluation must remain safe for prerendering.
      this.persistenceReady = Promise.resolve();
    } else {
      this.loadFromDisk();
    }
  }

  private usesPostgres(): boolean {
    return process.env.DEMO_MODE !== 'true' && Boolean(process.env.DATABASE_URL?.trim());
  }

  private async loadFromPostgres(): Promise<void> {
    try {
      const repository = globalThis.lumentorPostgresRepository;
      if (!repository) throw new Error('PostgreSQL repository is not initialized on the server.');
      const state = await repository.loadAppState();
      if (state) {
        this.data = { ...this.getDefaultState(), ...state };
        this.data.classcardConfig.apiKey = '';
        this.data.emailConfig.oauthClientSecret = '';
        this.data.emailConfig.oauthRefreshToken = '';
      } else {
        await repository.saveAppState(this.data);
      }
      this.initialized = true;
    } catch (err) {
      console.error('Failed to load PostgreSQL application state:', err);
      throw err;
    }
  }

  public async ready(): Promise<void> {
    if (!this.usesPostgres()) return;

    if (this.postgresLoadError) {
      this.postgresLoadStarted = false;
      this.postgresLoadError = undefined;
    }

    if (!this.postgresLoadStarted) {
      this.postgresLoadStarted = true;
      this.persistenceReady = this.loadFromPostgres().catch((error: unknown) => {
        this.postgresLoadError = error;
        throw error;
      });
    }
    await this.persistenceReady;
  }

  private getDefaultState(): AppDatabase {
    return {
      roles: [...SEED_ROLES],
      users: [...SEED_USERS],
      branches: [...SEED_BRANCHES],
      subjects: [...SEED_SUBJECTS],
      packages: [...SEED_PACKAGES],
      payrollPlans: [...SEED_PAYROLL_PLANS],
      mentors: [...SEED_MENTORS],
      students: [...SEED_STUDENTS],
      classes: [...SEED_CLASSES],
      penalties: [...SEED_PENALTIES],
      adjustments: [...SEED_ADJUSTMENTS],
      payrollPeriods: [...SEED_PAYROLL_PERIODS],
      payrollBatches: [],
      payslips: [...SEED_PAYSLIPS],
      invoices: [...SEED_INVOICES],
      payments: [...SEED_PAYMENTS],
      auditLogs: [...SEED_AUDIT_LOGS],
      classcardConfig: { ...INITIAL_CLASSCARD_CONFIG },
      classcardEndpoints: [...CLASSCARD_ENDPOINTS_REGISTRY],
      syncJobs: [...SEED_SYNC_JOBS],
      customFields: [...SEED_CUSTOM_FIELDS],
      emailConfig: { ...INITIAL_EMAIL_CONFIG },
      orgSettings: { ...INITIAL_ORG_SETTINGS },
    };
  }

  public reloadIfModified(): void {
    if (typeof window !== 'undefined') return;
    try {
      const node = getNodeFsAndPath();
      if (!node) return;
      const dataDir = node.path.join(process.cwd(), 'data');
      const dbFile = node.path.join(dataDir, 'db.json');
      if (node.fs.existsSync(dbFile)) {
        const stat = node.fs.statSync(dbFile);
        if (stat.mtimeMs > this.lastMtime) {
          const raw = node.fs.readFileSync(dbFile, 'utf-8');
          const parsed = JSON.parse(raw);
          this.data = { ...this.getDefaultState(), ...parsed };
          this.data.classcardConfig.apiKey = '';
          this.data.emailConfig.oauthClientSecret = '';
          this.data.emailConfig.oauthRefreshToken = '';
          this.lastMtime = stat.mtimeMs;
        }
      }
    } catch (err) {
      console.warn('Failed to check/reload db from disk:', err);
    }
  }

  private loadFromDisk(): void {
    if (this.initialized) return;
    try {
      const node = getNodeFsAndPath();
      if (node) {
        const dataDir = node.path.join(process.cwd(), 'data');
        const dbFile = node.path.join(dataDir, 'db.json');
        if (!node.fs.existsSync(dataDir)) {
          node.fs.mkdirSync(dataDir, { recursive: true });
        }
        if (node.fs.existsSync(dbFile)) {
          const raw = node.fs.readFileSync(dbFile, 'utf-8');
          const parsed = JSON.parse(raw);
          this.data = { ...this.getDefaultState(), ...parsed };

          // If mentors or classes are empty (e.g. from purge), re-populate baseline so system remains functional
          if (!this.data.mentors || this.data.mentors.length === 0) {
            this.data.mentors = [...SEED_MENTORS];
          }
          if (!this.data.classes || this.data.classes.length === 0) {
            this.data.classes = [...SEED_CLASSES];
          }
          if (!this.data.students || this.data.students.length === 0) {
            this.data.students = [...SEED_STUDENTS];
          }

          const stat = node.fs.statSync(dbFile);
          this.lastMtime = stat.mtimeMs;
        } else {
          this.saveToDisk();
        }
      }
    } catch (err) {
      console.warn('Failed to load db from disk, falling back to default memory state:', err);
    }
    this.initialized = true;
  }

  private saveToDisk(): void {
    if (this.usesPostgres()) {
      const repository = globalThis.lumentorPostgresRepository;
      if (!repository) return;
      const snapshot = this.data;
      this.persistenceQueue = this.persistenceQueue.then(() => repository.saveAppState(snapshot)).catch((err: unknown) => {
        console.error('Failed to persist application state to PostgreSQL:', err);
      });
      return;
    }

    try {
      const node = getNodeFsAndPath();
      if (node) {
        const dataDir = node.path.join(process.cwd(), 'data');
        const dbFile = node.path.join(dataDir, 'db.json');
        const tmpFile = node.path.join(dataDir, `db.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`);
        if (!node.fs.existsSync(dataDir)) {
          node.fs.mkdirSync(dataDir, { recursive: true });
        }
        // Atomic write: write to temp file then renameSync
        const persistedData = {
          ...this.data,
          classcardConfig: { ...this.data.classcardConfig, apiKey: '' },
          emailConfig: {
            ...this.data.emailConfig,
            oauthClientSecret: '',
            oauthRefreshToken: '',
          },
        };
        const jsonContent = JSON.stringify(persistedData, null, 2);
        node.fs.writeFileSync(tmpFile, jsonContent, 'utf-8');
        node.fs.renameSync(tmpFile, dbFile);
        this.lastMtime = Date.now();
      }
    } catch (err) {
      console.warn('Failed to persist db to disk:', err);
    }
  }

  public async persistNow(): Promise<void> {
    if (!this.usesPostgres()) return;
    const repository = globalThis.lumentorPostgresRepository;
    if (!repository) throw new Error('PostgreSQL repository is not initialized on the server.');
    const snapshot = this.data;
    this.persistenceQueue = this.persistenceQueue.then(() => repository.saveAppState(snapshot));
    await this.persistenceQueue;
  }

  // --- Audit Logging ---
  public logAudit(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const record: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.data.auditLogs.unshift(record);
    this.saveToDisk();
    return record;
  }

  public getAuditLogs(limit: number = 50): AuditEvent[] {
    return this.data.auditLogs.slice(0, limit);
  }

  // --- Users & Roles ---
  public getUsers(): CurrentUser[] {
    this.reloadIfModified();
    return this.data.users;
  }

  public getUserById(id: string): CurrentUser | undefined {
    this.reloadIfModified();
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): CurrentUser | undefined {
    this.reloadIfModified();
    const clean = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email.toLowerCase() === clean);
  }

  public getUserBySessionToken(token: string): CurrentUser | undefined {
    this.reloadIfModified();
    if (!token) return undefined;
    return this.data.users.find(
      (u) => u.sessionToken === token && (!u.sessionExpiry || new Date(u.sessionExpiry) > new Date())
    );
  }

  public getUserByResetToken(token: string): CurrentUser | undefined {
    this.reloadIfModified();
    if (!token) return undefined;
    return this.data.users.find(
      (u) => u.resetToken === token && (!u.resetTokenExpiry || new Date(u.resetTokenExpiry) > new Date())
    );
  }

  public saveUser(user: CurrentUser): CurrentUser {
    const idx = this.data.users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (idx === -1) {
      this.data.users.push(user);
    } else {
      this.data.users[idx] = { ...this.data.users[idx], ...user };
    }
    this.saveToDisk();
    return user;
  }

  public createUser(user: Omit<CurrentUser, 'id'> & { id?: string }): CurrentUser {
    this.reloadIfModified();
    const id = user.id || `user-${Date.now()}`;
    const newUser: CurrentUser = {
      ...user,
      id,
      status: user.status || 'ACTIVE',
      assignedBranchIds: user.assignedBranchIds || [],
      permissions: user.permissions || [],
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.saveToDisk();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<CurrentUser>): CurrentUser {
    this.reloadIfModified();
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      throw new Error(`User with ID ${id} not found`);
    }
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.users[idx];
  }

  public deleteUser(id: string): boolean {
    this.reloadIfModified();
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  public getRoles(): UserRole[] {
    return this.data.roles;
  }

  public createRole(role: Omit<UserRole, 'id' | 'createdAt' | 'updatedAt'>): UserRole {
    const newRole: UserRole = {
      ...role,
      id: `role-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.roles.push(newRole);
    this.saveToDisk();
    return newRole;
  }

  public updateRole(id: string, updates: Partial<UserRole>): UserRole {
    const index = this.data.roles.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`Role ${id} not found`);
    this.data.roles[index] = {
      ...this.data.roles[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.roles[index];
  }

  // --- Branches ---
  public getBranches(): Branch[] {
    return this.data.branches;
  }

  public getBranchById(id: string): Branch | undefined {
    return this.data.branches.find((b) => b.id === id);
  }

  public createBranch(branch: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Branch {
    const record: Branch = {
      ...branch,
      id: `branch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.branches.push(record);
    this.saveToDisk();
    return record;
  }

  public updateBranch(id: string, updates: Partial<Branch>): Branch {
    const index = this.data.branches.findIndex((b) => b.id === id);
    if (index === -1) throw new Error(`Branch ${id} not found`);
    this.data.branches[index] = {
      ...this.data.branches[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.branches[index];
  }

  // --- Subjects ---
  public getSubjects(): Subject[] {
    return this.data.subjects;
  }

  public getSubjectById(id: string): Subject | undefined {
    return this.data.subjects.find((s) => s.id === id);
  }

  public createSubject(subj: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>): Subject {
    const record: Subject = {
      ...subj,
      id: `subj-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.subjects.push(record);
    this.saveToDisk();
    return record;
  }

  public updateSubject(id: string, updates: Partial<Subject>): Subject {
    const idx = this.data.subjects.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Subject ${id} not found`);
    this.data.subjects[idx] = {
      ...this.data.subjects[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.subjects[idx];
  }

  // --- Packages ---
  public getPackages(): Package[] {
    return this.data.packages;
  }

  public getPackageById(id: string): Package | undefined {
    return this.data.packages.find((p) => p.id === id);
  }

  public createPackage(pkg: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Package {
    const record: Package = {
      ...pkg,
      id: `pkg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.packages.push(record);
    this.saveToDisk();
    return record;
  }

  public updatePackage(id: string, updates: Partial<Package>): Package {
    const idx = this.data.packages.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Package ${id} not found`);
    this.data.packages[idx] = {
      ...this.data.packages[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.packages[idx];
  }

  // --- Mentors ---
  public getMentors(branchId?: string): Mentor[] {
    if (!branchId || branchId === 'ALL') return this.data.mentors;
    return this.data.mentors.filter((m) => m.branchId === branchId);
  }

  public getMentorById(id: string): Mentor | undefined {
    return this.data.mentors.find((m) => m.id === id);
  }

  public getMentorByEmail(email: string): Mentor | undefined {
    return this.data.mentors.find((m) => m.email.toLowerCase() === email.toLowerCase());
  }

  public createMentor(mentor: Omit<Mentor, 'id' | 'createdAt' | 'updatedAt'>): Mentor {
    const record: Mentor = {
      ...mentor,
      id: `mentor-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.mentors.push(record);
    this.saveToDisk();
    return record;
  }

  public updateMentor(id: string, updates: Partial<Mentor>): Mentor {
    const idx = this.data.mentors.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Mentor ${id} not found`);
    this.data.mentors[idx] = {
      ...this.data.mentors[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.mentors[idx];
  }

  // --- Students ---
  public getStudents(branchId?: string): Student[] {
    if (!branchId || branchId === 'ALL') return this.data.students;
    return this.data.students.filter((s) => s.branchId === branchId);
  }

  public getStudentById(id: string): Student | undefined {
    return this.data.students.find((s) => s.id === id);
  }

  public createStudent(student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Student {
    const record: Student = {
      ...student,
      id: `stud-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.students.push(record);
    this.saveToDisk();
    return record;
  }

  public updateStudent(id: string, updates: Partial<Student>): Student {
    const idx = this.data.students.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Student ${id} not found`);
    this.data.students[idx] = {
      ...this.data.students[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.students[idx];
  }

  // --- Classes & Events ---
  public getClasses(filters?: {
    branchId?: string;
    mentorId?: string;
    subjectId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): ClassEvent[] {
    return this.data.classes.filter((c) => {
      if (filters?.branchId && filters.branchId !== 'ALL' && c.branchId !== filters.branchId) return false;
      if (filters?.mentorId && filters.mentorId !== 'ALL' && c.mentorId !== filters.mentorId) return false;
      if (filters?.subjectId && filters.subjectId !== 'ALL' && c.subjectId !== filters.subjectId) return false;
      if (filters?.status && filters.status !== 'ALL' && c.status !== filters.status) return false;
      if (filters?.startDate && new Date(c.startTime) < new Date(filters.startDate)) return false;
      if (filters?.endDate && new Date(c.startTime) > new Date(filters.endDate)) return false;
      return true;
    });
  }

  public getClassById(id: string): ClassEvent | undefined {
    return this.data.classes.find((c) => c.id === id);
  }

  public createClass(cls: Omit<ClassEvent, 'id' | 'createdAt' | 'updatedAt'>): ClassEvent {
    const record: ClassEvent = {
      ...cls,
      id: `cls-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.classes.push(record);
    this.saveToDisk();
    return record;
  }

  public updateClass(id: string, updates: Partial<ClassEvent>): ClassEvent {
    const idx = this.data.classes.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Class ${id} not found`);
    this.data.classes[idx] = {
      ...this.data.classes[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.classes[idx];
  }

  public updateAttendance(
    classId: string,
    studentId: string,
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
    markedBy: string,
    notes?: string
  ): ClassEvent {
    const cls = this.getClassById(classId);
    if (!cls) throw new Error(`Class ${classId} not found`);

    const studentIdx = cls.students.findIndex((s) => s.studentId === studentId);
    if (studentIdx === -1) throw new Error(`Student ${studentId} not in roster for class ${classId}`);

    cls.students[studentIdx].attendanceStatus = status;
    cls.students[studentIdx].markedAt = new Date().toISOString();
    cls.students[studentIdx].markedBy = markedBy;
    if (notes !== undefined) cls.students[studentIdx].notes = notes;

    // Recalculate summary
    const statuses = cls.students.map((s) => s.attendanceStatus);
    if (statuses.every((s) => s === 'PRESENT' || s === 'LATE')) {
      cls.attendanceStatusSummary = 'ALL_PRESENT';
    } else if (statuses.every((s) => s === 'ABSENT')) {
      cls.attendanceStatusSummary = 'ALL_ABSENT';
    } else if (statuses.some((s) => s === 'UNMARKED')) {
      cls.attendanceStatusSummary = 'UNMARKED';
    } else {
      cls.attendanceStatusSummary = 'PARTIAL';
    }

    // Auto mark class completed if all attendance marked and class was scheduled
    if (cls.status === 'SCHEDULED' && !statuses.includes('UNMARKED')) {
      cls.status = 'COMPLETED';
    }

    cls.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return cls;
  }

  // --- Payroll Plans ---
  public getPayrollPlans(): PayrollPlan[] {
    return this.data.payrollPlans;
  }

  public getPayrollPlanById(id: string): PayrollPlan | undefined {
    return this.data.payrollPlans.find((p) => p.id === id);
  }

  public createPayrollPlan(plan: Omit<PayrollPlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>): PayrollPlan {
    const record: PayrollPlan = {
      ...plan,
      id: `plan-${Date.now()}`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.payrollPlans.push(record);
    this.saveToDisk();
    return record;
  }

  public updatePayrollPlan(id: string, updates: Partial<PayrollPlan>, bumpVersion: boolean = false): PayrollPlan {
    const idx = this.data.payrollPlans.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Payroll plan ${id} not found`);

    const existing = this.data.payrollPlans[idx];
    const newVersion = bumpVersion ? existing.version + 1 : existing.version;

    this.data.payrollPlans[idx] = {
      ...existing,
      ...updates,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.payrollPlans[idx];
  }

  // --- Penalties & Adjustments ---
  public getPenalties(mentorId?: string): Penalty[] {
    if (!mentorId || mentorId === 'ALL') return this.data.penalties;
    return this.data.penalties.filter((p) => p.mentorId === mentorId);
  }

  public getPenaltyById(id: string): Penalty | undefined {
    return this.data.penalties.find((p) => p.id === id);
  }

  public createPenalty(penalty: Omit<Penalty, 'id' | 'createdAt' | 'status'>): Penalty {
    const record: Penalty = {
      ...penalty,
      id: `pen-${Date.now()}`,
      status: 'SUBMITTED', // Pending review
      createdAt: new Date().toISOString(),
    };
    this.data.penalties.unshift(record);
    this.saveToDisk();
    return record;
  }

  public approvePenalty(
    penaltyId: string,
    approverId: string,
    approverName: string
  ): Penalty {
    const pen = this.getPenaltyById(penaltyId);
    if (!pen) throw new Error(`Penalty ${penaltyId} not found`);

    // Anti-self-approval rule
    if (pen.createdBy === approverId) {
      throw new Error('Authorization violation: You cannot approve a penalty that you submitted yourself.');
    }

    if (pen.status !== 'SUBMITTED') {
      throw new Error(`Penalty is in ${pen.status} state, can only approve SUBMITTED penalties.`);
    }

    pen.status = 'APPROVED';
    pen.approvedBy = approverId;
    pen.approvedByName = approverName;
    pen.approvedAt = new Date().toISOString();
    this.saveToDisk();
    return pen;
  }

  public rejectPenalty(
    penaltyId: string,
    approverId: string,
    approverName: string,
    reason: string
  ): Penalty {
    const pen = this.getPenaltyById(penaltyId);
    if (!pen) throw new Error(`Penalty ${penaltyId} not found`);

    if (pen.createdBy === approverId) {
      throw new Error('Authorization violation: You cannot reject your own submitted penalty.');
    }

    pen.status = 'REJECTED';
    pen.approvedBy = approverId;
    pen.approvedByName = approverName;
    pen.rejectionReason = reason;
    this.saveToDisk();
    return pen;
  }

  public reversePenalty(
    penaltyId: string,
    reversedById: string,
    reversedByName: string,
    reversalReason: string
  ): Penalty {
    const pen = this.getPenaltyById(penaltyId);
    if (!pen) throw new Error(`Penalty ${penaltyId} not found`);

    if (pen.status !== 'APPROVED' && pen.status !== 'APPLIED') {
      throw new Error(`Cannot reverse penalty in ${pen.status} status.`);
    }

    pen.status = 'REVERSED';
    pen.reversedBy = reversedById;
    pen.reversedByName = reversedByName;
    pen.reversedAt = new Date().toISOString();
    pen.reversalReason = reversalReason;
    this.saveToDisk();
    return pen;
  }

  public disputePenalty(penaltyId: string, note: string): Penalty {
    const pen = this.getPenaltyById(penaltyId);
    if (!pen) throw new Error(`Penalty ${penaltyId} not found`);
    pen.disputeStatus = 'DISPUTED';
    pen.disputeNote = note;
    this.saveToDisk();
    return pen;
  }

  public getAdjustments(mentorId?: string): Adjustment[] {
    if (!mentorId || mentorId === 'ALL') return this.data.adjustments;
    return this.data.adjustments.filter((a) => a.mentorId === mentorId);
  }

  public createAdjustment(adj: Omit<Adjustment, 'id' | 'createdAt'>): Adjustment {
    const record: Adjustment = {
      ...adj,
      id: `adj-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.adjustments.push(record);
    this.saveToDisk();
    return record;
  }

  // --- Payroll Periods & Batches ---
  public getPayrollPeriods(): PayrollPeriod[] {
    return this.data.payrollPeriods;
  }

  public getPayrollBatches(): PayrollBatch[] {
    return this.data.payrollBatches;
  }

  public getPayrollBatchById(id: string): PayrollBatch | undefined {
    return this.data.payrollBatches.find((b) => b.id === id);
  }

  public savePayrollBatch(batch: PayrollBatch): PayrollBatch {
    const idx = this.data.payrollBatches.findIndex((b) => b.id === batch.id);
    if (idx === -1) {
      this.data.payrollBatches.unshift(batch);
    } else {
      this.data.payrollBatches[idx] = batch;
    }
    this.saveToDisk();
    return batch;
  }

  // --- Payslips ---
  public getPayslips(mentorId?: string): Payslip[] {
    if (!mentorId || mentorId === 'ALL') return this.data.payslips;
    return this.data.payslips.filter((p) => p.mentorId === mentorId);
  }

  public getPayslipById(id: string): Payslip | undefined {
    return this.data.payslips.find((p) => p.id === id);
  }

  public savePayslip(payslip: Payslip): Payslip {
    const idx = this.data.payslips.findIndex((p) => p.id === payslip.id);
    if (idx === -1) {
      this.data.payslips.unshift(payslip);
    } else {
      this.data.payslips[idx] = payslip;
    }
    this.saveToDisk();
    return payslip;
  }

  // --- Invoices & Payments ---
  public getInvoices(): Invoice[] {
    this.reloadIfModified();
    return this.data.invoices;
  }

  public createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'> & { id?: string }): Invoice {
    const record: Invoice = {
      ...invoice,
      id: invoice.id || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.invoices.unshift(record);
    this.saveToDisk();
    return record;
  }

  public updateInvoice(id: string, updates: Partial<Invoice>): Invoice | undefined {
    const idx = this.data.invoices.findIndex((inv) => inv.id === id || inv.externalId === id);
    if (idx === -1) return undefined;
    this.data.invoices[idx] = { ...this.data.invoices[idx], ...updates };
    this.saveToDisk();
    return this.data.invoices[idx];
  }

  public getPayments(): Payment[] {
    this.reloadIfModified();
    return this.data.payments;
  }

  public createPayment(payment: Omit<Payment, 'id' | 'createdAt'> & { id?: string }): Payment {
    const record: Payment = {
      ...payment,
      id: payment.id || `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.payments.unshift(record);
    this.saveToDisk();
    return record;
  }

  public updatePayment(id: string, updates: Partial<Payment>): Payment | undefined {
    const idx = this.data.payments.findIndex((p) => p.id === id || p.externalId === id);
    if (idx === -1) return undefined;
    this.data.payments[idx] = { ...this.data.payments[idx], ...updates };
    this.saveToDisk();
    return this.data.payments[idx];
  }

  // --- Classcard Integration ---
  public getClasscardConfig(): ClasscardConfig {
    return this.data.classcardConfig;
  }

  public updateClasscardConfig(updates: Partial<ClasscardConfig>): ClasscardConfig {
    this.data.classcardConfig = { ...this.data.classcardConfig, ...updates };
    this.saveToDisk();
    return this.data.classcardConfig;
  }

  public getClasscardEndpoints(): ClasscardEndpointInfo[] {
    return this.data.classcardEndpoints;
  }

  public getSyncJobs(): SyncJob[] {
    return this.data.syncJobs;
  }

  public addSyncJob(job: SyncJob): void {
    this.data.syncJobs.unshift(job);
    this.saveToDisk();
  }

  // --- Custom Fields & Mappings ---
  public getCustomFields(entityType?: CustomFieldEntityType): CustomFieldDefinition[] {
    if (!this.data.customFields) {
      this.data.customFields = [...SEED_CUSTOM_FIELDS];
    }
    if (!entityType || (entityType as string) === 'ALL') return this.data.customFields;
    return this.data.customFields.filter((cf) => cf.entityType === entityType);
  }

  public getCustomFieldById(id: string): CustomFieldDefinition | undefined {
    return this.getCustomFields().find((cf) => cf.id === id);
  }

  public saveCustomField(field: CustomFieldDefinition): CustomFieldDefinition {
    const list = this.getCustomFields();
    const idx = list.findIndex((cf) => cf.id === field.id);
    if (idx === -1) {
      list.push(field);
    } else {
      list[idx] = field;
    }
    this.data.customFields = list;
    this.saveToDisk();
    return field;
  }

  public createCustomField(field: Omit<CustomFieldDefinition, 'id' | 'createdAt' | 'updatedAt'>): CustomFieldDefinition {
    const now = new Date().toISOString();
    const newField: CustomFieldDefinition = {
      ...field,
      id: `cf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.saveCustomField(newField);
    return newField;
  }

  public deleteCustomField(id: string): boolean {
    const list = this.getCustomFields();
    const filtered = list.filter((cf) => cf.id !== id);
    if (filtered.length !== list.length) {
      this.data.customFields = filtered;
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // --- Email Settings ---
  public getEmailConfig(): EmailConfig {
    this.reloadIfModified();
    return this.data.emailConfig || { ...INITIAL_EMAIL_CONFIG };
  }

  public saveEmailConfig(config: Partial<EmailConfig>): EmailConfig {
    this.reloadIfModified();
    const current = this.getEmailConfig();
    const updated: EmailConfig = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString(),
    };
    this.data.emailConfig = updated;
    this.saveToDisk();
    return updated;
  }

  // --- Organization Settings ---
  public getOrgSettings(): OrganizationSettings {
    this.reloadIfModified();
    return this.data.orgSettings || { ...INITIAL_ORG_SETTINGS };
  }

  public saveOrgSettings(settings: Partial<OrganizationSettings>): OrganizationSettings {
    this.reloadIfModified();
    const current = this.getOrgSettings();
    const updated: OrganizationSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.data.orgSettings = updated;
    this.saveToDisk();
    return updated;
  }

  // --- Client/Server Hydration Snapshot ---
  public getSnapshot(): AppDatabase {
    this.reloadIfModified();
    return this.data;
  }

  public initClient(snapshot: AppDatabase): void {
    if (snapshot) {
      this.data = snapshot;
    }
  }

  // --- Reset to seed data ---
  public resetToSeed(): void {
    this.data = this.getDefaultState();
    this.saveToDisk();
  }

  // --- Purge Demo Data for Production API Mode ---
  public purgeDemoData(): void {
    this.data.students = [];
    this.data.mentors = [];
    this.data.classes = [];
    this.data.invoices = [];
    this.data.penalties = [];
    this.data.adjustments = [];
    this.data.payrollBatches = [];
    this.data.payslips = [];
    this.data.payments = [];
    this.data.syncJobs = [];
    this.data.classcardConfig.useMockMode = false;
    this.saveToDisk();
  }
}

export const db = new DataStore();
