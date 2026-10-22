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
} from '../types/models';
import {
  PayrollPlan,
  Penalty,
  PenaltyPolicy,
  Adjustment,
  PayrollPeriod,
  PayrollBatch,
  Payslip,
} from '../types/payroll';
import { UserRole, CurrentUser } from '../types/auth';
import { ClasscardConfig, ClasscardEndpointInfo, SyncJob } from '../types/classcard';
import { EmailConfig, OrganizationSettings } from '../types/email';

export const SEED_ROLES: UserRole[] = [
  {
    id: 'role-admin',
    name: 'Administrator',
    systemRole: 'ADMINISTRATOR',
    description: 'Full access to system configuration, payroll approval, and Classcard integration.',
    permissions: [
      { module: 'overview', actions: ['view', 'export'] },
      { module: 'calendar', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'classes', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'attendance', actions: ['view', 'create', 'edit', 'approve', 'export'] },
      { module: 'exceptions', actions: ['view', 'edit', 'approve', 'export'] },
      { module: 'mentors', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'students', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'branches', actions: ['view', 'create', 'edit', 'delete', 'manage_settings'] },
      { module: 'subjects', actions: ['view', 'create', 'edit', 'delete', 'manage_settings'] },
      { module: 'packages', actions: ['view', 'create', 'edit', 'delete', 'manage_settings'] },
      { module: 'payroll_dashboard', actions: ['view', 'export', 'view_sensitive_payroll'] },
      { module: 'payroll_rules', actions: ['view', 'create', 'edit', 'manage_settings', 'view_sensitive_payroll'] },
      { module: 'payroll_processing', actions: ['view', 'create', 'edit', 'approve', 'export', 'view_sensitive_payroll'] },
      { module: 'penalties', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export', 'view_sensitive_payroll'] },
      { module: 'payslips', actions: ['view', 'create', 'edit', 'export', 'view_sensitive_payroll'] },
      { module: 'reports', actions: ['view', 'export'] },
      { module: 'analytics', actions: ['view', 'export'] },
      { module: 'users_roles', actions: ['view', 'create', 'edit', 'delete', 'manage_settings'] },
      { module: 'classcard_integration', actions: ['view', 'create', 'edit', 'manage_settings'] },
      { module: 'audit_logs', actions: ['view', 'export'] },
      { module: 'settings', actions: ['view', 'edit', 'manage_settings'] },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-ops',
    name: 'Operations Specialist',
    systemRole: 'OPERATIONS',
    description: 'Day-to-day operations, scheduling, attendance exceptions, and penalty submission.',
    permissions: [
      { module: 'overview', actions: ['view'] },
      { module: 'calendar', actions: ['view', 'create', 'edit'] },
      { module: 'classes', actions: ['view', 'create', 'edit'] },
      { module: 'attendance', actions: ['view', 'create', 'edit'] },
      { module: 'exceptions', actions: ['view', 'edit'] },
      { module: 'mentors', actions: ['view'] },
      { module: 'students', actions: ['view', 'create', 'edit'] },
      { module: 'branches', actions: ['view'] },
      { module: 'subjects', actions: ['view'] },
      { module: 'packages', actions: ['view'] },
      { module: 'penalties', actions: ['view', 'create'] },
      { module: 'reports', actions: ['view', 'export'] },
      { module: 'analytics', actions: ['view'] },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-mentor',
    name: 'Mentor (Personal Portal)',
    systemRole: 'MENTOR',
    description: 'Personal schedule, assigned classes, earnings estimates, penalties, and finalized payslips.',
    permissions: [
      { module: 'overview', actions: ['view'] },
      { module: 'calendar', actions: ['view'] },
      { module: 'classes', actions: ['view'] },
      { module: 'attendance', actions: ['view'] },
      { module: 'penalties', actions: ['view'] },
      { module: 'payslips', actions: ['view', 'export'] },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const SEED_USERS: CurrentUser[] = [
  {
    id: 'user-super-admin',
    email: 'himanshu.m@letsunbound.com',
    name: 'Himanshu Mathankar',
    role: 'ADMINISTRATOR',
    roleName: 'Super Admin',
    assignedBranchIds: [],
    avatarUrl: '',
    permissions: SEED_ROLES[0].permissions,
    // Password hash for: admin@1290@
    passwordHash: '435d06d2937015006c74079f799d0b92fe8fbd29d24600faffd4b474a6a0177146e7e2bd0b45eae1f1c688512d5448539b63807c2384b256a20a9efaea7cd616',
    salt: '4bdf413f8a507f6e5046b89627425ad4',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const SEED_BRANCHES: Branch[] = [];

export const SEED_SUBJECTS: Subject[] = [];

export const SEED_PACKAGES: Package[] = [];

export const SEED_PAYROLL_PLANS: PayrollPlan[] = [
  {
    id: 'plan-hybrid-senior',
    name: 'Senior Mentor Hybrid Plan (v1.2)',
    code: 'PLAN-HYB-SR',
    description: 'Base salary plus class incentives and student bonuses. Designed for senior subject leads.',
    compensationModel: 'HYBRID',
    currency: 'INR',
    baseSalary: 2500.0,
    defaultClassRate: 45.0,
    hourlyRate: 50.0,
    perStudentRate: 10.0,
    revenuePercentage: 0,
    minEligibleDurationMinutes: 30,
    payableClassStatuses: ['COMPLETED', 'LATE_CANCELLED'],
    lateCancellationPayPercent: 50,
    groupMultiplier: 1.25,
    version: 2,
    effectiveFrom: '2026-01-01T00:00:00Z',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-per-class-std',
    name: 'Standard Per-Class Plan (v2.0)',
    code: 'PLAN-PERCLASS-STD',
    description: 'Flat rate per completed class. Late cancellation paid at 50%.',
    compensationModel: 'PER_CLASS',
    currency: 'INR',
    baseSalary: 0,
    defaultClassRate: 65.0,
    hourlyRate: 0,
    perStudentRate: 0,
    revenuePercentage: 0,
    minEligibleDurationMinutes: 45,
    payableClassStatuses: ['COMPLETED', 'LATE_CANCELLED'],
    lateCancellationPayPercent: 50,
    groupMultiplier: 1.3,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-duration-hourly',
    name: 'Duration-Based Hourly Plan (v1.0)',
    code: 'PLAN-HOURLY-PRO',
    description: 'Compensation directly calculated from teaching minutes (₹50.00/hour equivalent).',
    compensationModel: 'DURATION_BASED',
    currency: 'INR',
    baseSalary: 0,
    defaultClassRate: 0,
    hourlyRate: 50.0,
    perStudentRate: 0,
    revenuePercentage: 0,
    minEligibleDurationMinutes: 30,
    payableClassStatuses: ['COMPLETED'],
    lateCancellationPayPercent: 0,
    groupMultiplier: 1.0,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-per-student-group',
    name: 'Group Workshop Per-Student Model (v1.0)',
    code: 'PLAN-STUDENT-GRP',
    description: '₹22.00 per attending student in group workshops and seminar sessions.',
    compensationModel: 'PER_STUDENT',
    currency: 'INR',
    baseSalary: 0,
    defaultClassRate: 0,
    hourlyRate: 0,
    perStudentRate: 22.0,
    revenuePercentage: 0,
    minEligibleDurationMinutes: 45,
    payableClassStatuses: ['COMPLETED'],
    lateCancellationPayPercent: 0,
    groupMultiplier: 1.0,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-fixed-salary',
    name: 'Full-Time Instructor Salary (v1.0)',
    code: 'PLAN-SALARY-FT',
    description: 'Guaranteed monthly compensation (₹4,200.00/month) with absence deductions.',
    compensationModel: 'FIXED_SALARY',
    currency: 'INR',
    baseSalary: 4200.0,
    defaultClassRate: 0,
    hourlyRate: 0,
    perStudentRate: 0,
    revenuePercentage: 0,
    minEligibleDurationMinutes: 0,
    payableClassStatuses: ['COMPLETED', 'SCHEDULED'],
    lateCancellationPayPercent: 100,
    groupMultiplier: 1.0,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-revenue-share',
    name: 'Executive Revenue Share Plan (v1.1)',
    code: 'PLAN-REVSHARE-35',
    description: '35% revenue basis on completed sessions with verified payment.',
    compensationModel: 'PERCENTAGE_BASED',
    currency: 'INR',
    baseSalary: 0,
    defaultClassRate: 0,
    hourlyRate: 0,
    perStudentRate: 0,
    revenuePercentage: 35.0,
    minEligibleDurationMinutes: 45,
    payableClassStatuses: ['COMPLETED'],
    lateCancellationPayPercent: 25,
    groupMultiplier: 1.0,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00Z',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const SEED_MENTORS: Mentor[] = [];

export const SEED_STUDENTS: Student[] = [];

export const SEED_CLASSES: ClassEvent[] = [];

export const SEED_PENALTIES: Penalty[] = [];

export const SEED_PENALTY_POLICIES: PenaltyPolicy[] = [
  {
    id: 'POL-LATE-CANCEL',
    code: 'POL-LATE-CANCEL',
    name: 'Late Class Cancellation',
    description: 'Deduction applied when a mentor cancels within 2 hours of scheduled session start.',
    deductionType: 'PERCENT',
    rateValue: 50,
    defaultAmount: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'POL-NO-SHOW',
    code: 'POL-NO-SHOW',
    name: 'Unexcused Absence / No-Show',
    description: 'Deduction for failure to attend a scheduled session without advance notification.',
    deductionType: 'FIXED_AMOUNT',
    rateValue: 75,
    defaultAmount: 75,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'POL-LATE-ATTEND',
    code: 'POL-LATE-ATTEND',
    name: 'Late Attendance Submission',
    description: 'Deduction for submitting student attendance more than 48 hours after class conclusion.',
    deductionType: 'FIXED_AMOUNT',
    rateValue: 20,
    defaultAmount: 20,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const SEED_ADJUSTMENTS: Adjustment[] = [];

export const SEED_PAYROLL_PERIODS: PayrollPeriod[] = [];

export const SEED_PAYROLL_BATCH: PayrollBatch = {
  id: 'batch-empty',
  batchNumber: 'PAY-CLEAN',
  periodId: 'period-clean',
  periodName: 'Cycle Initial',
  startDate: '2026-10-01',
  endDate: '2026-10-15',
  branchName: 'All Branches',
  status: 'DRAFT',
  totalMentors: 0,
  totalEligibleClasses: 0,
  totalGross: 0,
  totalPenalties: 0,
  totalAdjustments: 0,
  totalNet: 0,
  currency: 'INR',
  paymentStatus: 'UNPAID',
  lineItems: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

export const SEED_PAYSLIPS: Payslip[] = [];

export const SEED_INVOICES: Invoice[] = [];

export const SEED_PAYMENTS: Payment[] = [];

export const SEED_AUDIT_LOGS: AuditEvent[] = [];

export const INITIAL_CLASSCARD_CONFIG: ClasscardConfig = {
  baseUrl: 'https://api.classcardapp.com/api/v2/public/',
  apiKey: '',
  isConfigured: false,
  useMockMode: true,
  lastSuccessfulSync: undefined,
  lastFailedSync: undefined,
  syncIntervalMinutes: 60,
};

export const CLASSCARD_ENDPOINTS_REGISTRY: ClasscardEndpointInfo[] = [
  // Students
  { id: 'ep-1', name: 'Add Student', group: 'Students', method: 'POST', endpoint: '/students', supported: true, status: 'OPERATIONAL', notes: 'Creates student record in Classcard' },
  { id: 'ep-2', name: 'Get Events', group: 'Students', method: 'GET', endpoint: '/students/{id}/events', supported: true, status: 'OPERATIONAL', notes: 'Retrieves scheduled sessions for student' },
  { id: 'ep-3', name: 'Get student list by email', group: 'Students', method: 'GET', endpoint: '/students/search?email={email}', supported: true, status: 'OPERATIONAL', notes: 'Safe search fallback by unique email' },
  { id: 'ep-4', name: 'Get Registered User Details', group: 'Students', method: 'GET', endpoint: '/students/{id}', supported: true, status: 'OPERATIONAL', notes: 'Core student profile details' },
  { id: 'ep-5', name: 'Get Registered User Details with custom fields', group: 'Students', method: 'GET', endpoint: '/students/{id}?include=custom_fields', supported: true, status: 'OPERATIONAL', notes: 'Custom attributes e.g. Grade, Target College' },
  { id: 'ep-6', name: 'Get Invoices', group: 'Students', method: 'GET', endpoint: '/students/{id}/invoices', supported: true, status: 'OPERATIONAL', notes: 'Billing invoices associated with student' },
  // Leads
  { id: 'ep-7', name: 'Add Lead', group: 'Leads', method: 'POST', endpoint: '/leads', supported: true, status: 'OPERATIONAL', notes: 'Capture prospective lead from website' },
  { id: 'ep-8', name: 'Get lead list', group: 'Leads', method: 'GET', endpoint: '/leads', supported: true, status: 'OPERATIONAL', notes: 'List unconverted inquiry leads' },
  // Staff
  { id: 'ep-9', name: 'Get Events', group: 'Staff', method: 'GET', endpoint: '/staff/{id}/events', supported: true, status: 'OPERATIONAL', notes: 'Staff calendar events' },
  { id: 'ep-10', name: 'Get Event', group: 'Staff', method: 'GET', endpoint: '/staff/events/{id}', supported: true, status: 'OPERATIONAL', notes: 'Individual event lookup' },
  { id: 'ep-11', name: 'Get Services', group: 'Staff', method: 'GET', endpoint: '/staff/{id}/services', supported: true, status: 'OPERATIONAL', notes: 'Subjects and services staff is qualified to teach' },
  // Invoices
  { id: 'ep-12', name: 'Get Invoice Detail', group: 'Invoices', method: 'GET', endpoint: '/invoices/{id}', supported: true, status: 'OPERATIONAL', notes: 'Invoice summary and line items' },
  { id: 'ep-13', name: 'Get invoices with items', group: 'Invoices', method: 'GET', endpoint: '/invoices', supported: true, status: 'OPERATIONAL', notes: 'Paginated invoices list' },
  { id: 'ep-14', name: 'Add Invoice', group: 'Invoices', method: 'POST', endpoint: '/invoices', supported: true, status: 'OPERATIONAL', notes: 'Create tuition invoice' },
  { id: 'ep-15', name: 'Edit Invoice', group: 'Invoices', method: 'PUT', endpoint: '/invoices/{id}', supported: true, status: 'OPERATIONAL', notes: 'Update invoice metadata' },
  // Payments
  { id: 'ep-16', name: 'Get payments with items', group: 'Payments', method: 'GET', endpoint: '/payments', supported: true, status: 'OPERATIONAL', notes: 'Received transaction log' },
  // Enrolments
  { id: 'ep-17', name: 'Late Cancel Enrolment', group: 'Enrolments', method: 'POST', endpoint: '/enrolments/{id}/late-cancel', supported: true, status: 'OPERATIONAL', notes: 'Marks session late-cancelled per policy' },
  { id: 'ep-18', name: 'Add Enrolment', group: 'Enrolments', method: 'POST', endpoint: '/enrolments', supported: true, status: 'OPERATIONAL', notes: 'Enrols student into package or class' },
  { id: 'ep-19', name: 'Remove Enrolment', group: 'Enrolments', method: 'DELETE', endpoint: '/enrolments/{id}', supported: true, status: 'OPERATIONAL', notes: 'Cancels enrolment' },
  // Items & Categories
  { id: 'ep-20', name: 'Get items', group: 'Items and Categories', method: 'GET', endpoint: '/items', supported: true, status: 'OPERATIONAL', notes: 'Package and material catalogue' },
  { id: 'ep-21', name: 'Get categories with subject and durations', group: 'Items and Categories', method: 'GET', endpoint: '/categories', supported: true, status: 'OPERATIONAL', notes: 'Subject categories and duration configs' },
  // Coupons & Events
  { id: 'ep-22', name: 'Get Coupons', group: 'Coupons and Events', method: 'GET', endpoint: '/coupons', supported: true, status: 'OPERATIONAL', notes: 'Promotional discounts' },
  { id: 'ep-23', name: 'Get events', group: 'Coupons and Events', method: 'GET', endpoint: '/events', supported: true, status: 'OPERATIONAL', notes: 'Global calendar events feed' },
  // Attendance
  { id: 'ep-24', name: 'Get attendances', group: 'Attendance', method: 'GET', endpoint: '/attendances', supported: true, status: 'OPERATIONAL', notes: 'Synchronizes marked attendance records' },
  // Credit Notes
  { id: 'ep-25', name: 'Get Credit Notes', group: 'Credit Notes', method: 'GET', endpoint: '/credit-notes', supported: true, status: 'OPERATIONAL', notes: 'Tuition adjustment notes' },
  // Guardian
  { id: 'ep-26', name: 'Get guardian detail', group: 'Guardian', method: 'GET', endpoint: '/guardians/{id}', supported: true, status: 'OPERATIONAL', notes: 'Parent contact information' },
  { id: 'ep-27', name: 'Get guardians', group: 'Guardian', method: 'GET', endpoint: '/guardians', supported: true, status: 'OPERATIONAL', notes: 'Parent registry list' },
];

export const SEED_SYNC_JOBS: SyncJob[] = [];

export const SEED_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: 'cf-1',
    name: 'Academic Grade Level',
    key: 'grade_level',
    entityType: 'STUDENT',
    fieldType: 'SELECT',
    classcardFieldKey: 'custom_field_grade',
    classcardEndpoint: 'GET /students/{id}/custom-fields',
    isRequired: true,
    options: ['9th Grade', '10th Grade', '11th Grade', '12th Grade', 'College Freshman'],
    defaultValue: '11th Grade',
    description: 'Current high school or undergraduate academic standing',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cf-2',
    name: 'Target College / University',
    key: 'target_college',
    entityType: 'STUDENT',
    fieldType: 'TEXT',
    classcardFieldKey: 'custom_field_target_college',
    classcardEndpoint: 'GET /students/{id}/custom-fields',
    isRequired: false,
    defaultValue: '',
    description: 'Aspirational higher-ed institutions for test prep planning',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cf-3',
    name: 'Instructional Specialist Tier',
    key: 'specialist_level',
    entityType: 'MENTOR',
    fieldType: 'SELECT',
    classcardFieldKey: 'staff_tier',
    classcardEndpoint: 'GET /staff/{id}',
    isRequired: true,
    options: ['Associate Mentor', 'Senior Mentor', 'Master Instructor', 'Department Lead'],
    defaultValue: 'Senior Mentor',
    description: 'Faculty ranking used for bonus eligibility and tier scaling',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cf-4',
    name: 'Classroom AV Setup Required',
    key: 'av_required',
    entityType: 'CLASS',
    fieldType: 'BOOLEAN',
    classcardFieldKey: 'event_av_req',
    classcardEndpoint: 'GET /events/{id}',
    isRequired: false,
    defaultValue: 'false',
    description: 'Requires interactive smart board or video conference terminal',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cf-5',
    name: 'Digital Recording & Proctoring Consent',
    key: 'recording_consent',
    entityType: 'STUDENT',
    fieldType: 'BOOLEAN',
    classcardFieldKey: 'custom_field_recording_consent',
    classcardEndpoint: 'GET /students/{id}/custom-fields',
    isRequired: true,
    defaultValue: 'true',
    description: 'Parental consent on file for session recording and archival',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const INITIAL_EMAIL_CONFIG: EmailConfig = {
  host: 'smtp.gmail.com',
  port: 465,
  security: 'SSL_TLS',
  authRequired: true,
  user: '',
  fromEmail: '',
  fromName: 'LUmentor Faculty & Operations',
  pass: '',
  allowSelfSignedCert: false,
  isEnabled: false,
  lastTestStatus: 'UNTESTED',
};

export const INITIAL_ORG_SETTINGS: OrganizationSettings = {
  orgName: 'LUmentor Educational Services',
  currency: 'INR',
  timezone: 'America/New_York',
  cutoffDay: 15,
};
