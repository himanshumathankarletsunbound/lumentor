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
  SEED_PAYROLL_BATCH,
  SEED_PAYSLIPS,
  SEED_INVOICES,
  SEED_PAYMENTS,
  SEED_AUDIT_LOGS,
  INITIAL_CLASSCARD_CONFIG,
  CLASSCARD_ENDPOINTS_REGISTRY,
  SEED_SYNC_JOBS,
} from './seedData';

interface AppDatabase {
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
}

function getNodeFsAndPath() {
  if (typeof window === 'undefined') {
    try {
      // Use eval to prevent bundlers like Turbopack/Webpack from attempting to bundle fs into client code
      const req = eval('require');
      return {
        fs: req('fs'),
        path: req('path'),
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

  constructor() {
    this.data = this.getDefaultState();
    this.loadFromDisk();
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
      payrollBatches: [{ ...SEED_PAYROLL_BATCH }],
      payslips: [...SEED_PAYSLIPS],
      invoices: [...SEED_INVOICES],
      payments: [...SEED_PAYMENTS],
      auditLogs: [...SEED_AUDIT_LOGS],
      classcardConfig: { ...INITIAL_CLASSCARD_CONFIG },
      classcardEndpoints: [...CLASSCARD_ENDPOINTS_REGISTRY],
      syncJobs: [...SEED_SYNC_JOBS],
    };
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
    try {
      const node = getNodeFsAndPath();
      if (node) {
        const dataDir = node.path.join(process.cwd(), 'data');
        const dbFile = node.path.join(dataDir, 'db.json');
        if (!node.fs.existsSync(dataDir)) {
          node.fs.mkdirSync(dataDir, { recursive: true });
        }
        node.fs.writeFileSync(dbFile, JSON.stringify(this.data, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('Failed to persist db to disk:', err);
    }
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
    return this.data.users;
  }

  public getUserById(id: string): CurrentUser | undefined {
    return this.data.users.find((u) => u.id === id);
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
    return this.data.invoices;
  }

  public getPayments(): Payment[] {
    return this.data.payments;
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

  // --- Reset to seed data ---
  public resetToSeed(): void {
    this.data = this.getDefaultState();
    this.saveToDisk();
  }
}

export const db = new DataStore();
