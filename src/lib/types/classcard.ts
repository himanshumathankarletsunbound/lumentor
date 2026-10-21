export interface ClasscardConfig {
  baseUrl: string;
  apiKey: string; // Stored server-side only; frontend receives masked version e.g. "cc_live_...94b"
  isConfigured: boolean;
  useMockMode: boolean; // Enables sandbox/mock responses when live key is not supplied or for testing
  lastSuccessfulSync?: string;
  lastFailedSync?: string;
  lastErrorMessage?: string;
  syncIntervalMinutes: number;
}

export type SyncJobType =
  | 'ALL'
  | 'STUDENTS'
  | 'STAFF'
  | 'EVENTS'
  | 'ATTENDANCE'
  | 'INVOICES'
  | 'CATEGORIES'
  | 'INVENTORY';

export type SyncJobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

export interface SyncJob {
  id: string;
  jobType: SyncJobType;
  status: SyncJobStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage?: string;
  logSummary: string[];
}

export interface ClasscardEndpointInfo {
  id: string;
  name: string;
  group: 'Students' | 'Leads' | 'Staff' | 'Invoices' | 'Payments' | 'Enrolments' | 'Items and Categories' | 'Coupons and Events' | 'Attendance' | 'Credit Notes' | 'Guardian' | 'Other';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  supported: boolean;
  status: 'OPERATIONAL' | 'DEGRADED' | 'UNTESTED' | 'RATE_LIMITED';
  lastTestedAt?: string;
  notes: string;
}

export interface FieldMapping {
  id: string;
  sourceEntity: 'ClasscardStudent' | 'ClasscardStaff' | 'ClasscardEvent' | 'ClasscardInvoice';
  sourceField: string;
  targetEntity: 'Student' | 'Mentor' | 'ClassEvent' | 'Invoice';
  targetField: string;
  transform?: string;
  isRequired: boolean;
}

export interface ClasscardLeadAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface ClasscardLeadInput {
  firstName: string;
  surname?: string;
  email?: string;
  phone1?: string;
  field1?: string;
  photo?: string | null;
  nationality?: string | null;
  dob?: string | null;
  source?: string | null;
  address?: ClasscardLeadAddress;
  school?: string | null;
  schoolYear?: string | null;
  curriculum?: string | null;
  parentFirstName?: string | null;
  parentSurname?: string | null;
  relation?: string | null;
  parentEmail?: string | null;
  parentPhone1?: string | null;
  invoiceTo?: string | null;
  field2?: string | null;
  signature?: string | null;
  gender?: string | null;
  isEmergency?: 0 | 1;
}

export interface ClasscardOneOnOneServiceRow {
  subject_id: number;
  duration_id: number;
  subject_name: string;
  duration: number;
  image_url: string | null;
  selected: boolean;
}

export interface ClasscardOneOnOneServiceCategory {
  category_id: number;
  name: string;
  color: string;
  selected_count: number;
  total_count: number;
  rows: ClasscardOneOnOneServiceRow[];
}

export interface ClasscardOneOnOneServices {
  prerequisites: {
    take_classes: boolean;
    working_hours_set: boolean;
  };
  categories: ClasscardOneOnOneServiceCategory[];
}

export interface ClasscardInventoryQuery {
  status?: number;
  orderBy?: 'product_id' | 'name' | 'status';
  direction?: 'asc' | 'desc';
  search?: string;
  perPage?: number;
}

export interface ClasscardInventoryResponse {
  data?: unknown[];
  products?: unknown[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  [key: string]: unknown;
}
