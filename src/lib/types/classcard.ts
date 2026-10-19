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
  | 'CATEGORIES';

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
