import { ClassStatus, AttendanceStatus } from './models';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarFilter {
  branchId?: string;
  subjectId?: string;
  mentorId?: string;
  classStatus?: ClassStatus | 'ALL';
  attendanceStatus?: AttendanceStatus | 'ALL';
  searchQuery?: string;
  date: Date;
}

export interface CalendarSummaryMetrics {
  total: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  lateCancelled: number;
  unmarked: number;
}
