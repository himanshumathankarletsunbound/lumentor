import { NextRequest, NextResponse } from 'next/server';
import { getEncryptedSecret } from '../../../../lib/db/secure-storage';
import { prisma } from '../../../../lib/db/prisma';
import { upsertClasscardEventRecord } from '../../../../lib/db/state-repository';

function rowsFrom(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'));
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) if (Array.isArray(record[key])) return rowsFrom(record[key], keys);
  return [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
  try {
    [payload, attendancePayload] = await Promise.all([
      request(`events?start=${toDate(start)}&end=${toDate(now)}`),
      request(`attendance?start_date=${toDate(start)}&end_date=${toDate(now)}`),
    ]);
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Classcard sync failed.' }, { status: 502 });
  }
  const rows = rowsFrom(payload, ['events', 'data', 'results']);
  const attendanceRows = rowsFrom(attendancePayload, ['attendance', 'data', 'results']);
  const attendanceByEventStudent = new Map<string, unknown>();
  const attendanceStudentsByEvent = new Map<string, Record<string, unknown>[]>();
  for (const attendance of attendanceRows) {
    const event = objectValue(attendance.event);
    const eventId = String(attendance.event_id ?? event.id ?? '').trim();
    const studentId = String(attendance.user_detail_id ?? attendance.student_id ?? attendance.user_id ?? '').trim();
    if (eventId && studentId) {
      attendanceByEventStudent.set(`${eventId}:${studentId}`, attendance.type ?? attendance.attendance_status);
      const students = attendanceStudentsByEvent.get(eventId) || [];
      students.push({ ...attendance, user_detail_id: studentId });
      attendanceStudentsByEvent.set(eventId, students);
    }
  }
  let saved = 0;
  let sessionsMapped = 0;
  let attendanceMapped = 0;
  const unmatched = { mentors: new Set<string>(), subjects: new Set<string>(), students: new Set<string>() };
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const event = item as Record<string, unknown>;
    const externalId = String(event.id || '').trim();
    const startTime = new Date(String(event.start || ''));
    const endTime = new Date(String(event.end || ''));
    if (!externalId || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) continue;
    const staffId = String(event.organizer || (Array.isArray(event.resourceIds) ? event.resourceIds[0] : '') || '').replace(/^0+/, '');
    const subjectData = objectValue(event.subject);
    const subjectExternalId = String(event.subject_id || subjectData.id || '').trim();
    const mentor = staffId ? await prisma.mentor.findFirst({ where: { externalId: staffId } }) : null;
    const subject = subjectExternalId ? await prisma.subject.findFirst({ where: { externalId: subjectExternalId } }) : null;
    if (!mentor) unmatched.mentors.add(staffId);
    if (!subject) unmatched.subjects.add(subjectExternalId);
    const eventStudents = Array.isArray(event.studentDetails) ? event.studentDetails.map(objectValue) : [];
    const knownStudentIds = new Set(eventStudents.map((student) => String(student.user_detail_id ?? student.student_id ?? student.user_id ?? '').trim()));
    for (const attendanceStudent of attendanceStudentsByEvent.get(externalId) || []) {
      const studentId = String(attendanceStudent.user_detail_id || '').trim();
      if (!knownStudentIds.has(studentId)) {
        eventStudents.push(attendanceStudent);
        knownStudentIds.add(studentId);
      }
    }
    await upsertClasscardEventRecord({ externalId, mentorId: mentor?.id, classcardStaffId: staffId, subjectName: String(event.subjectName || subjectData.name || ''), subjectExternalId, locationName: String(event.locationName || event.location || ''), startTime, endTime, attendanceStatus: String(event.attendance_status || ''), rawPayload: JSON.parse(JSON.stringify(event)) });
    if (mentor && subject) {
      const classEvent = await prisma.classEvent.upsert({
        where: { externalId },
        create: { id: `classcard-${externalId}`, branchId: mentor.branchId, subjectId: subject.id, mentorId: mentor.id, title: String(event.subjectName || subject.name), startTime, endTime, durationMinutes: Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)), status: 'COMPLETED', externalId, provenance: 'CLASSCARD_SOURCED' },
        update: { branchId: mentor.branchId, subjectId: subject.id, mentorId: mentor.id, title: String(event.subjectName || subject.name), startTime, endTime, status: 'COMPLETED', provenance: 'CLASSCARD_SOURCED' },
      });
      sessionsMapped++;
      for (const studentRow of eventStudents) {
        const studentExternalId = String(studentRow.user_detail_id ?? studentRow.student_id ?? studentRow.user_id ?? '').trim();
        const student = studentExternalId ? await prisma.student.findFirst({ where: { externalId: studentExternalId } }) : null;
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
