import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { getEncryptedSecret, setEncryptedSecret } from '../../../../lib/db/secure-storage';
import { listClasscardEventRecords, materializeClasscardEventForPayroll, upsertClasscardEventRecord } from '../../../../lib/db/state-repository';
import { prisma } from '../../../../lib/db/prisma';
import type { Prisma } from '@prisma/client';

const defaultBaseUrl = 'https://api.classcardapp.com/api/v2/public';

async function config() {
  const raw = await getEncryptedSecret('classcard.config');
  const value = raw ? JSON.parse(raw) as { baseUrl?: string; apiKey?: string; syncIntervalMinutes?: number; enabled?: boolean } : {};
  const storedApiKey = String(value.apiKey || '').trim();
  return {
    baseUrl: value.baseUrl || process.env.CLASSCARD_API_BASE_URL || defaultBaseUrl,
    apiKey: process.env.CLASSCARD_API_KEY?.trim() || (storedApiKey && !isMaskedApiKey(storedApiKey) ? storedApiKey : ''),
    syncIntervalMinutes: value.syncIntervalMinutes || 60,
    enabled: value.enabled ?? true,
  };
}

function isMaskedApiKey(value: string): boolean {
  return value.includes('••••') || value.includes('…') || value === '[configured]';
}

async function classcardFetch(path: string, method: 'GET' | 'POST', body?: unknown) {
  const settings = await config();
  if (!settings.apiKey) throw new Error('Classcard API key is not configured.');
  const requestUrl = path.startsWith('/api/public/')
    ? new URL(path, settings.baseUrl).origin + path
    : `${settings.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const response = await fetch(requestUrl, {
    method,
    headers: { Accept: 'application/json', 'api-key': settings.apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Classcard rejected the API key (401 Unauthorized). Re-enter the complete current API key in Settings; do not paste the masked value shown on screen.');
    }
    throw new Error(`Classcard API returned ${response.status}: ${typeof data === 'string' ? data : response.statusText}`);
  }
  return data;
}

const apiCatalog = {
  staffOneOnOneServices: { path: '/api/public/staff/one-on-one-services', parameter: 'staff_id' },
  staffEvents: { path: '/staff/events/', parameter: 'staff' },
  staffServices: { path: '/staff/services', parameter: 'staff_id' },
  inventoryProducts: { path: '/inventory/products', parameter: null },
  students: { path: '/students', parameter: null },
  studentEvents: { path: '/students/{student_id}/events', parameter: 'student_id' },
  studentDetails: { path: '/students/{student_id}', parameter: 'student_id' },
  studentInvoices: { path: '/students/{student_id}/invoices', parameter: 'student_id' },
  events: { path: '/events', parameter: null },
  attendance: { path: '/attendance', parameter: null },
  invoices: { path: '/invoices', parameter: null },
} as const;

type ApiKey = keyof typeof apiCatalog;

function eventRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['events', 'data', 'results', 'records', 'items', 'attendance']) {
      if (Array.isArray(record[key])) return eventRows(record[key]);
      if (record[key] && typeof record[key] === 'object') {
        const nested = eventRows(record[key]);
        if (nested.length > 0) return nested;
      }
    }
  }
  return [];
}

function attendanceRows(data: unknown): Record<string, unknown>[] {
  return eventRows(data);
}

function isDateInRange(value: unknown, start: string, end: string): boolean {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return false;
  const datePart = date.toISOString().slice(0, 10);
  return datePart >= start && datePart <= end;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return undefined;
}

function classcardId(value: unknown): string {
  const id = String(value ?? '').trim();
  return id.replace(/^0+(?=\d)/, '');
}

function eventId(row: Record<string, unknown>): string {
  const event = objectValue(row.event);
  const direct = firstValue(row, ['event_id', 'class_event_id']);
  const nested = firstValue(event, ['id', 'event_id']);
  const eventLike = firstValue(row, ['start', 'start_time', 'start_at', 'subject_id']) !== undefined;
  return classcardId(direct ?? nested ?? (eventLike ? row.id : undefined));
}

function studentId(row: Record<string, unknown>): string {
  const student = objectValue(firstValue(row, ['student', 'student_detail', 'user_detail']));
  return classcardId(firstValue(row, ['user_detail_id', 'user_detailId', 'student_id', 'studentId', 'user_id', 'userId']) ??
    firstValue(student, ['user_detail_id', 'user_detailId', 'student_id', 'studentId', 'user_id', 'userId', 'id']));
}

function eventStart(row: Record<string, unknown>): unknown {
  const event = objectValue(row.event);
  return firstValue(row, ['start', 'start_time', 'start_at', 'event_start', 'date', 'attendance_date', 'event_date']) ??
    firstValue(event, ['start', 'start_time', 'start_at', 'event_start', 'date']);
}

function eventEnd(row: Record<string, unknown>): unknown {
  const event = objectValue(row.event);
  return firstValue(row, ['end', 'end_time', 'end_at', 'event_end']) ??
    firstValue(event, ['end', 'end_time', 'end_at', 'event_end']) ??
    eventStart(row);
}

function staffId(row: Record<string, unknown>): string {
  const organizer = objectValue(row.organizer);
  const staff = objectValue(firstValue(row, ['staff', 'mentor', 'teacher', 'coach']));
  const resources = Array.isArray(row.resourceIds) ? row.resourceIds[0] : undefined;
  const directOrganizer = typeof row.organizer === 'string' || typeof row.organizer === 'number' ? row.organizer : undefined;
  return classcardId(firstValue(row, ['organizer_id', 'staff_id', 'mentor_id', 'teacher_id', 'coach_id']) ?? directOrganizer ??
    firstValue(organizer, ['id', 'staff_id', 'user_detail_id']) ??
    firstValue(staff, ['id', 'staff_id', 'user_detail_id']) ?? resources);
}

function subjectId(row: Record<string, unknown>): string {
  const subject = objectValue(row.subject);
  return classcardId(firstValue(row, ['subject_id', 'subjectId', 'service_id']) ?? firstValue(subject, ['id', 'subject_id', 'subjectId']));
}

function idCandidates(value: string): string[] {
  const normalized = classcardId(value);
  return normalized && normalized !== value ? [value, normalized] : normalized ? [normalized] : [];
}

function classcardStudentRows(event: Record<string, unknown>): Record<string, unknown>[] {
  const rows = firstValue(event, ['studentDetails', 'student_details', 'students', 'student']);
  if (Array.isArray(rows)) return rows.map(objectValue).filter((row) => Object.keys(row).length > 0);
  const single = objectValue(rows);
  return Object.keys(single).length > 0 ? [single] : [];
}

function attendanceStatus(value: unknown): 'PRESENT' | 'ABSENT' | 'ABSENT_BILLABLE' | 'LATE' | 'EXCUSED' | 'UNMARKED' {
  const status = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (status.includes('billable') && status.includes('absent')) return 'ABSENT_BILLABLE';
  if (status.includes('present')) return 'PRESENT';
  if (status.includes('late')) return 'LATE';
  if (status.includes('excused')) return 'EXCUSED';
  if (status.includes('absent')) return 'ABSENT';
  return 'UNMARKED';
}

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'classcard_integration', 'view');
  if (denied) return denied;
  const mode = new URL(req.url).searchParams.get('mode') || 'settings';
  if (mode === 'events') {
    const user = await getSessionUserAsync(req);
    const mentorId = user?.role === 'MENTOR' ? user.mentorId || undefined : new URL(req.url).searchParams.get('mentorId') || undefined;
    const start = new URL(req.url).searchParams.get('start');
    const end = new URL(req.url).searchParams.get('end');
    const events = await listClasscardEventRecords(mentorId);
    return NextResponse.json({
      success: true,
      events: start && end ? events.filter((event) => isDateInRange(event.startTime, start, end)) : events,
    });
  }
  if (mode === 'logs') {
    return NextResponse.json({ success: true, logs: await prisma.syncJob.findMany({ orderBy: { startedAt: 'desc' }, take: 100 }) });
  }
  const settings = await config();
  return NextResponse.json({ success: true, settings: { ...settings, apiKey: '', apiKeyHint: settings.apiKey ? `${settings.apiKey.slice(0, 4)}••••${settings.apiKey.slice(-4)}` : '', isConfigured: Boolean(settings.apiKey) } });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'classcard_integration', 'manage_settings');
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (body.action === 'save-settings') {
      const current = await config();
      const next = {
        baseUrl: String(body.baseUrl || current.baseUrl).trim(),
        apiKey: (() => {
          const submitted = String(body.apiKey || '').trim();
          return submitted && !isMaskedApiKey(submitted) ? submitted : current.apiKey;
        })(),
        syncIntervalMinutes: Math.max(5, Number(body.syncIntervalMinutes || current.syncIntervalMinutes)),
        enabled: Boolean(body.enabled),
      };
      if (!next.baseUrl.startsWith('https://')) throw new Error('Classcard base URL must use HTTPS.');
      if (!next.apiKey) throw new Error('Classcard API key is required.');
      await setEncryptedSecret('classcard.config', JSON.stringify(next));
      return NextResponse.json({ success: true, settings: { ...next, apiKey: '', apiKeyHint: `${next.apiKey.slice(0, 4)}••••${next.apiKey.slice(-4)}`, isConfigured: true } });
    }
    if (body.action === 'reconcile-month') {
      const start = String(body.start || '2026-10-01').trim();
      const end = String(body.end || '2026-10-31').trim();
      const mentorsWithClasscardIds = await prisma.mentor.findMany({
        where: { externalId: { not: '' } },
        select: { externalId: true },
      });
      if (mentorsWithClasscardIds.length === 0) {
        throw new Error('No mentors with Classcard IDs are configured, so Classcard events cannot be fetched.');
      }
      const eventResponses = await Promise.all(mentorsWithClasscardIds.map(async ({ externalId }) => ({
        externalId,
        data: await classcardFetch(`staff/events/?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&staff=${encodeURIComponent(externalId)}`, 'GET'),
      })));
      const attendanceData = await classcardFetch(`attendance?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`, 'GET');
      const eventRowsForMonth = eventResponses.flatMap(({ externalId, data }) => eventRows(data).map((event): Record<string, unknown> => ({
        ...event,
        organizer: event.organizer ?? externalId,
      }))).filter((event) => isDateInRange(eventStart(event), start, end));
      const attendanceForMonth = attendanceRows(attendanceData).filter((row) => {
        const value = eventStart(row);
        return !value || isDateInRange(value, start, end);
      });
      const attendanceByEventStudent = new Map<string, unknown>();
      const attendanceStudentsByEvent = new Map<string, Record<string, unknown>[]>();
      for (const row of attendanceForMonth) {
        const currentEventId = eventId(row);
        const currentStudentId = studentId(row);
        const value = firstValue(row, ['type', 'attendance_status', 'status', 'attendance_type']);
        if (currentEventId && currentStudentId) {
          attendanceByEventStudent.set(`${currentEventId}:${currentStudentId}`, value);
          const students = attendanceStudentsByEvent.get(currentEventId) || [];
          students.push({ ...row, user_detail_id: currentStudentId });
          attendanceStudentsByEvent.set(currentEventId, students);
        }
      }
      const unmatched = { mentors: [] as Array<Record<string, string>>, subjects: [] as Array<Record<string, string>>, students: [] as Array<Record<string, string>> };
      const seen = { mentors: new Set<string>(), subjects: new Set<string>(), students: new Set<string>() };
      let sessionsMapped = 0;
      let attendanceMapped = 0;
      for (const event of eventRowsForMonth) {
        const externalId = eventId(event);
        const startTime = new Date(String(eventStart(event) || ''));
        const endTime = new Date(String(eventEnd(event) || ''));
        if (!externalId || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) continue;
        const subjectData = objectValue(event.subject);
        const subjectExternalId = subjectId(event);
        const currentStaffId = staffId(event);
        const mentor = currentStaffId ? await prisma.mentor.findFirst({ where: { externalId: { in: idCandidates(currentStaffId) } } }) : null;
        const subject = subjectExternalId ? await prisma.subject.findFirst({ where: { externalId: { in: idCandidates(subjectExternalId) } } }) : null;
        if (!mentor && !seen.mentors.has(currentStaffId)) { seen.mentors.add(currentStaffId); unmatched.mentors.push({ classcardId: currentStaffId, eventId: externalId }); }
        if (!subject && !seen.subjects.has(subjectExternalId)) { seen.subjects.add(subjectExternalId); unmatched.subjects.push({ classcardId: subjectExternalId, name: String(event.subjectName || subjectData.name || ''), eventId: externalId }); }
        await upsertClasscardEventRecord({
          externalId, mentorId: mentor?.id, classcardStaffId: currentStaffId,
          subjectName: String(event.subjectName || subjectData.name || ''), subjectExternalId,
          locationName: String(event.locationName || event.location || ''), startTime, endTime,
          attendanceStatus: String(event.attendance_status || ''), rawPayload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
        });
        if (!mentor || !subject) continue;
        const classEvent = await prisma.classEvent.upsert({
          where: { externalId },
          create: { id: `classcard-${externalId}`, branchId: mentor.branchId, subjectId: subject.id, mentorId: mentor.id, title: String(event.subjectName || subject.name), startTime, endTime, durationMinutes: Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)), status: 'COMPLETED', externalId, provenance: 'CLASSCARD_SOURCED' },
          update: { branchId: mentor.branchId, subjectId: subject.id, mentorId: mentor.id, title: String(event.subjectName || subject.name), startTime, endTime, status: 'COMPLETED', provenance: 'CLASSCARD_SOURCED' },
        });
        await prisma.classcardEvent.update({ where: { externalId }, data: { classEventId: classEvent.id } });
        sessionsMapped++;
        const eventStudents = classcardStudentRows(event);
        const knownStudentIds = new Set(eventStudents.map(studentId));
        for (const row of attendanceStudentsByEvent.get(externalId) || []) {
          if (!knownStudentIds.has(studentId(row))) eventStudents.push(row);
        }
        for (const studentRow of eventStudents) {
          const studentExternalId = studentId(studentRow);
          const student = studentExternalId ? await prisma.student.findFirst({ where: { externalId: { in: idCandidates(studentExternalId) } } }) : null;
          if (!student) {
            const key = studentExternalId || String(studentRow.name || 'unknown');
            if (!seen.students.has(key)) { seen.students.add(key); unmatched.students.push({ classcardId: studentExternalId, name: String(studentRow.name || ''), eventId: externalId }); }
            continue;
          }
          const row = attendanceByEventStudent.get(`${externalId}:${studentExternalId}`);
          await prisma.classAttendance.upsert({
            where: { classEventId_studentId: { classEventId: classEvent.id, studentId: student.id } },
            create: { id: crypto.randomUUID(), classEventId: classEvent.id, studentId: student.id, status: attendanceStatus(row), markedAt: row ? new Date() : null, provenance: 'CLASSCARD_SOURCED', externalId: `${externalId}:${studentExternalId}` },
            update: { status: attendanceStatus(row), markedAt: row ? new Date() : null, provenance: 'CLASSCARD_SOURCED', externalId: `${externalId}:${studentExternalId}` },
          });
          attendanceMapped++;
        }
      }
      return NextResponse.json({ success: true, start, end, fetchedEvents: eventRowsForMonth.length, fetchedAttendance: attendanceForMonth.length, sessionsMapped, attendanceMapped, unmatched });
    }
    if (body.action === 'sync-events') {
      const start = String(body.start || '').trim();
      const end = String(body.end || '').trim();
      if (!start || !end) throw new Error('Start and end dates are required.');
      const staff = String(body.staff || '').trim();
      const subject = String(body.subject || '').trim();
      const location = String(body.location || '').trim();
      const path = staff ? 'staff/events/' : 'events';
      const query = new URLSearchParams({ start, end });
      if (staff) query.set('staff', staff);
      if (subject) query.set('subject', subject);
      if (location) query.set('location', location);
      const data = await classcardFetch(`${path}?${query.toString()}`, 'GET');
      const rows = eventRows(data).filter((event) => isDateInRange(event.start, start, end));
      let saved = 0;
      let materialized = 0;
      for (const event of rows) {
        const externalId = String(event.id || '').trim();
        const startTime = new Date(String(event.start || ''));
        const endTime = new Date(String(event.end || ''));
        if (!externalId || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) continue;
        const staffId = String(event.organizer || (Array.isArray(event.resourceIds) ? event.resourceIds[0] : '') || '').replace(/^0+/, '');
        const mentor = staffId ? await prisma.mentor.findFirst({ where: { externalId: staffId } }) : null;
        const subject = event.subject && typeof event.subject === 'object' ? event.subject as Record<string, unknown> : {};
        await upsertClasscardEventRecord({
          externalId,
          mentorId: mentor?.id,
          classcardStaffId: staffId,
          subjectName: String(event.subjectName || subject.name || ''),
          subjectExternalId: String(event.subject_id || subject.id || ''),
          locationName: String(event.locationName || event.location || ''),
          startTime,
          endTime,
          attendanceStatus: String(event.attendance_status || ''),
          rawPayload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
        });
        if (String(event.attendance_status || '').toLowerCase() === 'present') {
          const payrollEvent = await materializeClasscardEventForPayroll(externalId);
          if (payrollEvent.materialized) materialized++;
        }
        saved++;
      }
      await prisma.syncJob.create({ data: { id: crypto.randomUUID(), jobType: 'EVENTS', status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(), recordsProcessed: rows.length, recordsCreated: saved, recordsUpdated: 0, recordsFailed: rows.length - saved, logSummary: [`Fetched ${rows.length} event records and saved ${saved}.`] } });
      return NextResponse.json({ success: true, fetched: rows.length, saved, materialized });
    }
    if (body.action === 'request-api') {
      const api = String(body.api || '') as ApiKey;
      if (!(api in apiCatalog)) throw new Error('That Classcard API is not available.');
      const definition = apiCatalog[api];
      const params = body.params && typeof body.params === 'object' ? body.params as Record<string, unknown> : {};
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value).trim());
      }
      if (definition.parameter && !query.get(definition.parameter)) {
        throw new Error(`${definition.parameter} is required.`);
      }
      if (api === 'inventoryProducts') {
        const perPage = Number(query.get('per_page') || 15);
        if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) throw new Error('per_page must be between 1 and 100.');
      }
      const path = `${definition.path.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(query.get(key) || ''))}${query.toString() ? `?${query.toString()}` : ''}`;
      const data = await classcardFetch(path, 'GET');
      return NextResponse.json({ success: true, api, data });
    }
    if (body.action === 'sync-attendance') {
      const start = String(body.start || '').trim();
      const end = String(body.end || '').trim();
      if (!start || !end) throw new Error('Start and end dates are required.');
      const data = await classcardFetch(`attendance?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`, 'GET');
      const rows = attendanceRows(data).filter((row) => {
        const event = row.event && typeof row.event === 'object' ? row.event as Record<string, unknown> : {};
        return isDateInRange(row.date || event.start, start, end);
      });
      const grouped = new Map<string, Set<string>>();
      for (const row of rows) {
        const event = row.event && typeof row.event === 'object' ? row.event as Record<string, unknown> : {};
        const eventId = String(row.event_id ?? event.id ?? '').trim();
        if (!eventId) continue;
        const statuses = grouped.get(eventId) || new Set<string>();
        statuses.add(String(row.type || row.attendance_status || '').trim().toLowerCase());
        grouped.set(eventId, statuses);
      }
      let updated = 0;
      for (const [externalId, statuses] of grouped) {
        const attendanceStatus = statuses.has('present')
          ? 'Present'
          : statuses.has('absent')
            ? 'Absent'
            : Array.from(statuses).find(Boolean) || 'Unknown';
        const result = await prisma.classcardEvent.updateMany({ where: { externalId }, data: { attendanceStatus } });
        updated += result.count;
        if (attendanceStatus === 'Present') await materializeClasscardEventForPayroll(externalId);
      }
      await prisma.syncJob.create({
        data: {
          id: crypto.randomUUID(),
          jobType: 'ATTENDANCE',
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          recordsProcessed: rows.length,
          recordsCreated: 0,
          recordsUpdated: updated,
          recordsFailed: rows.length - grouped.size,
          logSummary: [`Fetched ${rows.length} attendance rows and updated ${updated} saved events.`],
        },
      });
      return NextResponse.json({ success: true, fetched: rows.length, updated });
    }
    throw new Error('Unsupported Classcard integration action.');
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Classcard integration failed.' }, { status: 400 });
  }
}
