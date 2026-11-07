import { NextRequest, NextResponse } from 'next/server';
import { getEncryptedSecret } from '../../../../lib/db/secure-storage';
import { prisma } from '../../../../lib/db/prisma';
import { upsertClasscardEventRecord } from '../../../../lib/db/state-repository';

function rowsFrom(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'));
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) return rowsFrom(record[key], keys);
    if (record[key] && typeof record[key] === 'object') {
      const nested = rowsFrom(record[key], keys);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function id(value: unknown): string {
  return String(value ?? '').trim().replace(/^0+(?=\d)/, '');
}

function first(record: Record<string, unknown>, keys: string[]): unknown {
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null && value !== '');
}

function eventId(row: Record<string, unknown>): string {
  const nested = objectValue(row.event);
  return id(first(row, ['event_id', 'class_event_id', 'id']) ?? first(nested, ['id', 'event_id']));
}

function studentId(row: Record<string, unknown>): string {
  const nested = objectValue(first(row, ['student', 'user', 'user_detail']));
  return id(first(row, ['user_detail_id', 'student_id', 'studentId', 'user_id']) ??
    first(nested, ['user_detail_id', 'student_id', 'id']));
}

function dateValue(row: Record<string, unknown>): unknown {
  const nested = objectValue(row.event);
  return first(row, ['start', 'start_time', 'date', 'attendance_date']) ??
    first(nested, ['start', 'start_time', 'date']);
}

function endValue(row: Record<string, unknown>): unknown {
  const nested = objectValue(row.event);
  return first(row, ['end', 'end_time']) ?? first(nested, ['end', 'end_time']) ?? dateValue(row);
}

function subjectId(row: Record<string, unknown>): string {
  const subject = objectValue(row.subject);
  const classData = objectValue(row.class);
  return id(first(row, ['subject_id', 'subjectId', 'service_id']) ??
    first(subject, ['id', 'subject_id']) ?? first(classData, ['subject_id', 'subjectId']));
}

function gibbonCourseClassId(row: Record<string, unknown>): string {
  const classData = objectValue(row.class);
  return id(first(row, ['gibbonCourseClassID', 'gibbonCourseClassId']) ?? first(classData, ['gibbonCourseClassID', 'gibbonCourseClassId']));
}

function staffId(row: Record<string, unknown>): string {
  const staff = objectValue(first(row, ['staff', 'mentor', 'teacher', 'coach']));
  const organizer = typeof row.organizer === 'string' || typeof row.organizer === 'number' ? row.organizer : undefined;
  return id(first(row, ['organizer_id', 'staff_id', 'mentor_id', 'teacher_id', 'coach_id']) ??
    organizer ?? first(staff, ['id', 'staff_id', 'user_detail_id']) ??
    (Array.isArray(row.resourceIds) ? row.resourceIds[0] : undefined));
}

function statusValue(row: Record<string, unknown>): unknown {
  return first(row, ['type', 'attendance_status', 'status', 'attendance_type']);
}

function candidates(value: string): string[] {
  const normalized = id(value);
  return normalized && normalized !== value ? [value, normalized] : normalized ? [normalized] : [];
}

function statusFrom(value: unknown): 'PRESENT' | 'ABSENT' | 'ABSENT_BILLABLE' | 'LATE' | 'EXCUSED' | 'UNMARKED' {
  const status = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (status.includes('billable') && status.includes('absent')) return 'ABSENT_BILLABLE';
  if (status.includes('present')) return 'PRESENT';
  if (status.includes('late')) return 'LATE';
  if (status.includes('excused')) return 'EXCUSED';
  if (status.includes('absent')) return 'ABSENT';
  return 'UNMARKED';
}

export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const requestSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!configuredSecret || requestSecret !== configuredSecret) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  const configText = await getEncryptedSecret('classcard.config');
  if (!configText) return NextResponse.json({ success: true, skipped: true, reason: 'Classcard integration is not configured.' });
  const settings = JSON.parse(configText) as { baseUrl: string; apiKey: string; enabled?: boolean; syncIntervalMinutes?: number; lastAutomaticSyncAt?: string };
  settings.apiKey = process.env.CLASSCARD_API_KEY?.trim() ||
    (settings.apiKey.includes('••••') || settings.apiKey === '[configured]' ? '' : settings.apiKey);
  if (!settings.apiKey) return NextResponse.json({ success: false, error: 'Classcard API key is not configured for the hourly job.' }, { status: 503 });
  if (!settings.enabled) return NextResponse.json({ success: true, skipped: true, reason: 'Automatic sync is disabled.' });
  if (settings.lastAutomaticSyncAt && Date.now() - new Date(settings.lastAutomaticSyncAt).getTime() < (settings.syncIntervalMinutes || 60) * 60_000) {
    return NextResponse.json({ success: true, skipped: true, reason: 'Sync interval has not elapsed.' });
  }
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 1);
  const toDate = (date: Date) => date.toISOString().slice(0, 10);
  const headers = { Accept: 'application/json', 'api-key': settings.apiKey };
  const request = async (path: string) => {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/${path}`, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Classcard API returned ${response.status} for ${path}.`);
    return response.json() as Promise<unknown>;
  };
  let payload: unknown;
  let attendancePayload: unknown;
  const mentors = await prisma.mentor.findMany({ where: { externalId: { not: '' } }, select: { externalId: true } });
  try {
    const eventResponses = await Promise.all(mentors.map(async ({ externalId }) => ({
      externalId,
      data: await request(`staff/events/?start=${toDate(start)}&end=${toDate(now)}&staff=${encodeURIComponent(externalId)}`),
    })));
    payload = eventResponses.flatMap(({ externalId, data }) => rowsFrom(data, ['events', 'data', 'results', 'records', 'items']).map((event) => ({
      ...event,
      organizer: event.organizer ?? externalId,
    })));
    attendancePayload = await request(`attendance?start_date=${toDate(start)}&end_date=${toDate(now)}`);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Classcard sync failed.' }, { status: 502 });
  }
  const rows = rowsFrom(payload, ['events', 'data', 'results', 'records', 'items']);
  const attendanceRows = rowsFrom(attendancePayload, ['attendance', 'data', 'results', 'records', 'items']);
  const attendanceByEventStudent = new Map<string, unknown>();
  const attendanceStudentsByEvent = new Map<string, Record<string, unknown>[]>();
  for (const attendance of attendanceRows) {
    const currentEventId = eventId(attendance);
    const currentStudentId = studentId(attendance);
    if (currentEventId && currentStudentId) {
      attendanceByEventStudent.set(`${currentEventId}:${currentStudentId}`, statusValue(attendance));
      const students = attendanceStudentsByEvent.get(currentEventId) || [];
      students.push({ ...attendance, user_detail_id: currentStudentId });
      attendanceStudentsByEvent.set(currentEventId, students);
    }
  }
  let saved = 0;
  let sessionsMapped = 0;
  let attendanceMapped = 0;
  const unmatched = { mentors: new Set<string>(), subjects: new Set<string>(), students: new Set<string>() };
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const event = item as Record<string, unknown>;
    const externalId = eventId(event);
    const startTime = new Date(String(dateValue(event) || ''));
    const endTime = new Date(String(endValue(event) || ''));
    if (!externalId || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) continue;
    const currentStaffId = staffId(event);
    const subjectData = objectValue(event.subject);
    const subjectExternalId = subjectId(event);
    const mentor = currentStaffId ? await prisma.mentor.findFirst({ where: { externalId: { in: candidates(currentStaffId) } } }) : null;
    const subject = subjectExternalId ? await prisma.subject.findFirst({ where: { externalId: { in: candidates(subjectExternalId) } } }) : null;
    if (!mentor) unmatched.mentors.add(currentStaffId);
    if (!subject) unmatched.subjects.add(subjectExternalId);
    const rawStudents = event.studentDetails ?? event.student_details ?? event.students ?? event.student;
    const eventStudents = Array.isArray(rawStudents) ? rawStudents.map(objectValue) : [];
    const knownStudentIds = new Set(eventStudents.map(studentId));
    for (const attendanceStudent of attendanceStudentsByEvent.get(externalId) || []) {
      const currentStudentId = studentId(attendanceStudent);
      if (!knownStudentIds.has(currentStudentId)) {
        eventStudents.push(attendanceStudent);
        knownStudentIds.add(currentStudentId);
      }
    }
    await upsertClasscardEventRecord({ externalId, mentorId: mentor?.id, classcardStaffId: currentStaffId, subjectName: String(event.subjectName || subjectData.name || ''), subjectExternalId, gibbonCourseClassId: gibbonCourseClassId(event), locationName: String(event.locationName || event.location || ''), startTime, endTime, attendanceStatus: String(event.attendance_status || ''), rawPayload: JSON.parse(JSON.stringify(event)) });
    if (mentor && subject) {
      const classEvent = await prisma.classEvent.upsert({
        where: { externalId },
        create: { id: `classcard-${externalId}`, branchId: mentor.branchId, subjectId: subject.id, mentorId: mentor.id, title: String(event.subjectName || subject.name), startTime, endTime, durationMinutes: Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)), status: 'COMPLETED', externalId, provenance: 'CLASSCARD_SOURCED' },
        update: { branchId: mentor.branchId, subjectId: subject.id, mentorId: mentor.id, title: String(event.subjectName || subject.name), startTime, endTime, status: 'COMPLETED', provenance: 'CLASSCARD_SOURCED' },
      });
      await prisma.classcardEvent.update({ where: { externalId }, data: { classEventId: classEvent.id } });
      sessionsMapped++;
      for (const studentRow of eventStudents) {
        const studentExternalId = studentId(studentRow);
        const student = studentExternalId ? await prisma.student.findFirst({ where: { externalId: { in: candidates(studentExternalId) } } }) : null;
        if (!student) { unmatched.students.add(studentExternalId || String(studentRow.name || 'unknown')); continue; }
        const attendanceValue = attendanceByEventStudent.get(`${externalId}:${studentExternalId}`);
        await prisma.classAttendance.upsert({
          where: { classEventId_studentId: { classEventId: classEvent.id, studentId: student.id } },
          create: { id: crypto.randomUUID(), classEventId: classEvent.id, studentId: student.id, status: statusFrom(attendanceValue), markedAt: attendanceValue ? now : null, provenance: 'CLASSCARD_SOURCED', externalId: `${externalId}:${studentExternalId}` },
          update: { status: statusFrom(attendanceValue), markedAt: attendanceValue ? now : null, provenance: 'CLASSCARD_SOURCED', externalId: `${externalId}:${studentExternalId}` },
        });
        attendanceMapped++;
      }
    }
    saved++;
  }
  await prisma.encryptedSecret.update({ where: { name: 'classcard.config' }, data: { ciphertext: (await import('../../../../lib/db/secure-storage')).encryptSecret(JSON.stringify({ ...settings, lastAutomaticSyncAt: now.toISOString() })) } });
  await prisma.syncJob.create({ data: { id: crypto.randomUUID(), jobType: 'ATTENDANCE_AUTOMATIC', status: 'COMPLETED', startedAt: now, completedAt: new Date(), recordsProcessed: rows.length, recordsCreated: sessionsMapped, recordsUpdated: attendanceMapped, recordsFailed: rows.length - sessionsMapped, logSummary: [`Automatic Classcard sync saved ${saved} events, mapped ${sessionsMapped} sessions and ${attendanceMapped} attendance records.`, `Unmatched mentors: ${[...unmatched.mentors].filter(Boolean).join(', ') || 'none'}`, `Unmatched subjects: ${[...unmatched.subjects].filter(Boolean).join(', ') || 'none'}`, `Unmatched students: ${[...unmatched.students].filter(Boolean).join(', ') || 'none'}`] } });
  return NextResponse.json({ success: true, fetched: rows.length, attendanceFetched: attendanceRows.length, saved, sessionsMapped, attendanceMapped, unmatched: { mentors: [...unmatched.mentors], subjects: [...unmatched.subjects], students: [...unmatched.students] } });
}
