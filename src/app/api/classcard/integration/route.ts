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
  return {
    baseUrl: value.baseUrl || process.env.CLASSCARD_API_BASE_URL || defaultBaseUrl,
    apiKey: value.apiKey || process.env.CLASSCARD_API_KEY || '',
    syncIntervalMinutes: value.syncIntervalMinutes || 60,
    enabled: value.enabled ?? true,
  };
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
  if (!response.ok) throw new Error(`Classcard API returned ${response.status}: ${typeof data === 'string' ? data : response.statusText}`);
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
    for (const key of ['events', 'data', 'results']) if (Array.isArray(record[key])) return eventRows(record[key]);
  }
  return [];
}

function attendanceRows(data: unknown): Record<string, unknown>[] {
  return eventRows(data).filter((row) => row.event_id !== undefined || row.event !== undefined);
}

function isDateInRange(value: unknown, start: string, end: string): boolean {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return false;
  const datePart = date.toISOString().slice(0, 10);
  return datePart >= start && datePart <= end;
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
  return NextResponse.json({ success: true, settings: { ...settings, apiKey: settings.apiKey ? `${settings.apiKey.slice(0, 4)}••••${settings.apiKey.slice(-4)}` : '', isConfigured: Boolean(settings.apiKey) } });
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
        apiKey: String(body.apiKey || current.apiKey).trim(),
        syncIntervalMinutes: Math.max(5, Number(body.syncIntervalMinutes || current.syncIntervalMinutes)),
        enabled: Boolean(body.enabled),
      };
      if (!next.baseUrl.startsWith('https://')) throw new Error('Classcard base URL must use HTTPS.');
      if (!next.apiKey) throw new Error('Classcard API key is required.');
      await setEncryptedSecret('classcard.config', JSON.stringify(next));
      return NextResponse.json({ success: true, settings: { ...next, apiKey: `${next.apiKey.slice(0, 4)}••••${next.apiKey.slice(-4)}`, isConfigured: true } });
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
