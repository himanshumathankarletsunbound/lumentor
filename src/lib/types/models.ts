export type DataProvenance =
  | 'CLASSCARD_SOURCED'
  | 'LOCALLY_CREATED'
  | 'LOCALLY_MODIFIED'
  | 'PENDING_SYNC'
  | 'SYNC_FAILED'
  | 'RECONCILED';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  timezone: string;
  phone: string;
  email: string;
  isActive: boolean;
  provenance: DataProvenance;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  defaultDurationMinutes: number;
  availableDurations: number[]; // e.g. [30, 45, 60, 90, 120]
  isActive: boolean;
  color: string;
  provenance: DataProvenance;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Package {
  id: string;
  name: string;
  code: string;
  price: number;
  currency: string;
  totalSessions: number;
  validityDays: number;
  subjectIds: string[];
  branchIds: string[];
  isActive: boolean;
  provenance: DataProvenance;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: string;
  name: string;
  email: string;
  phone: string;
  relation: string;
  externalId?: string;
  provenance: DataProvenance;
  createdAt: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  branchId: string;
  dateOfBirth?: string;
  guardianId?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardian?: Guardian;
  enrolledPackageIds: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'LEAD' | 'GRADUATED';
  externalId?: string; // Classcard student ID
  provenance: DataProvenance;
  customFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Mentor {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  branchId: string;
  branchName?: string;
  subjectIds: string[];
  payrollPlanId: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  externalId?: string; // Classcard staff ID
  provenance: DataProvenance;
  teachingHoursThisMonth: number;
  completedClassesCount: number;
  attendanceRate: number;
  hourlyRate?: number;
  createdAt: string;
  updatedAt: string;
}

export type ClassStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'LATE_CANCELLED';

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'ABSENT_BILLABLE'
  | 'LATE'
  | 'EXCUSED'
  | 'UNMARKED';

export interface ClassStudentRoster {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attendanceStatus: AttendanceStatus;
  markedAt?: string;
  markedBy?: string;
  notes?: string;
}

export interface ClassEvent {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  mentorId: string;
  mentorName: string;
  branchId: string;
  branchName: string;
  packageId?: string;
  packageName?: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  durationMinutes: number;
  isGroup: boolean;
  capacity: number;
  students: ClassStudentRoster[];
  status: ClassStatus;
  attendanceStatusSummary: 'ALL_PRESENT' | 'PARTIAL' | 'ALL_ABSENT' | 'UNMARKED';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  isLateCancellation: boolean;
  room?: string;
  meetingLink?: string;
  externalId?: string; // Classcard Event ID
  provenance: DataProvenance;
  syncStatus?: 'SYNCED' | 'PENDING' | 'ERROR';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Enrolment {
  id: string;
  studentId: string;
  packageId: string;
  branchId: string;
  sessionsTotal: number;
  sessionsRemaining: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  startDate: string;
  expiryDate: string;
  externalId?: string;
  provenance: DataProvenance;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  branchId: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'VOID';
  items: InvoiceItem[];
  externalId?: string;
  provenance: DataProvenance;
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentDate: string;
  method: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'CASH' | 'STRIPE' | 'OTHER';
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED';
  externalId?: string;
  provenance: DataProvenance;
  createdAt: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  reason: string;
  issueDate: string;
  externalId?: string;
  provenance: DataProvenance;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress?: string;
  branchId?: string;
}

export type CustomFieldEntityType = 'STUDENT' | 'MENTOR' | 'CLASS' | 'LEAD';
export type CustomFieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'DATE';

export interface CustomFieldDefinition {
  id: string;
  name: string;
  key: string;
  entityType: CustomFieldEntityType;
  fieldType: CustomFieldType;
  classcardFieldKey?: string;
  classcardEndpoint?: string;
  isRequired: boolean;
  options?: string[];
  defaultValue?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
