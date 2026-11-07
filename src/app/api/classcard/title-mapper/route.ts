import { NextRequest, NextResponse } from 'next/server';
import { authorizationErrorAsync, getSessionUserAsync } from '../../../../lib/auth/server';
import { ensureServerPersistence } from '../../../../lib/db/server-initialization';
import { prisma } from '../../../../lib/db/prisma';

type RawRecord = Record<string, unknown>;

function object(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawRecord : {};
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function rawClassId(payload: unknown): string {
  const record = object(payload);
  const classRecord = object(record.class);
  return text(record.gibbonCourseClassID || record.gibbonCourseClassId || classRecord.gibbonCourseClassID || classRecord.gibbonCourseClassId);
}

function rawTitle(payload: unknown): string {
  const record = object(payload);
  return text(record.title || record.name || object(record.event).title);
}

function rawStudentIds(payload: unknown): string[] {
  const record = object(payload);
  const values = record.studentDetails || record.student_details || record.students;
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(object).map((student) => text(student.user_detail_id || student.student_id || student.user_id)).filter(Boolean))];
}

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_rules', 'view');
  if (denied) return denied;

  const url = new URL(req.url);
  const requestedClassId = text(url.searchParams.get('classId'));
  const search = text(url.searchParams.get('search')).toLowerCase();
  const status = text(url.searchParams.get('status'));
  const mentorId = text(url.searchParams.get('mentorId'));
  const payrollPlanId = text(url.searchParams.get('payrollPlanId'));
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 25)));

  const events = await prisma.classcardEvent.findMany({
    where: mentorId ? { mentorId } : undefined,
    orderBy: { startTime: 'desc' },
    select: {
      externalId: true, gibbonCourseClassId: true, subjectExternalId: true, subjectName: true,
      startTime: true, endTime: true, rawPayload: true,
      mentor: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  const mappings = await prisma.classcardClassMapping.findMany({ include: { payrollPlan: { select: { id: true, name: true, code: true } } } });
  const mappingByClassId = new Map(mappings.map((mapping) => [mapping.gibbonCourseClassId, mapping]));

  if (requestedClassId) {
    const matchingEvents = events.filter((event) => (event.gibbonCourseClassId || rawClassId(event.rawPayload)) === requestedClassId);
    const mapping = mappingByClassId.get(requestedClassId);
    return NextResponse.json({ success: true, detail: {
      classId: requestedClassId,
      mapping: mapping ? { payrollPlanId: mapping.payrollPlanId, payrollPlan: mapping.payrollPlan, status: mapping.status, displayTitle: mapping.displayTitle } : null,
      events: matchingEvents.map((event) => ({ externalId: event.externalId, title: rawTitle(event.rawPayload), startTime: event.startTime, endTime: event.endTime, subjectExternalId: event.subjectExternalId, subjectName: event.subjectName, mentor: event.mentor ? `${event.mentor.firstName} ${event.mentor.lastName}`.trim() : null, studentIds: rawStudentIds(event.rawPayload) })),
    } });
  }

  const groups = new Map<string, {
    classId: string | null; title: string; titles: Set<string>; eventCount: number; mentors: Map<string, string>;
    studentIds: Set<string>; firstSession: Date; lastSession: Date; subjectIds: Set<string>; subjectNames: Set<string>; eventIds: string[];
  }>();
  for (const event of events) {
    const classId = event.gibbonCourseClassId || rawClassId(event.rawPayload);
    const key = classId || `missing:${event.externalId}`;
    const title = rawTitle(event.rawPayload);
    const group = groups.get(key) || { classId: classId || null, title, titles: new Set<string>(), eventCount: 0, mentors: new Map<string, string>(), studentIds: new Set<string>(), firstSession: event.startTime, lastSession: event.startTime, subjectIds: new Set<string>(), subjectNames: new Set<string>(), eventIds: [] };
    if (title) group.titles.add(title);
    if (!group.title && title) group.title = title;
    group.eventCount++;
    group.eventIds.push(event.externalId);
    if (event.mentor) group.mentors.set(event.mentor.id, `${event.mentor.firstName} ${event.mentor.lastName}`.trim());
    rawStudentIds(event.rawPayload).forEach((id) => group.studentIds.add(id));
    if (event.subjectExternalId) group.subjectIds.add(event.subjectExternalId);
    if (event.subjectName) group.subjectNames.add(event.subjectName);
    if (event.startTime < group.firstSession) group.firstSession = event.startTime;
    if (event.startTime > group.lastSession) group.lastSession = event.startTime;
    groups.set(key, group);
  }

  const allRows = [...groups.values()].map((group) => {
    const mapping = group.classId ? mappingByClassId.get(group.classId) : undefined;
    const needsReview = !group.classId || group.titles.size > 1;
    const mappingStatus = needsReview ? 'NEEDS_REVIEW' : mapping?.status || 'UNMAPPED';
    return { classId: group.classId, title: group.title || 'Untitled event', titles: [...group.titles], eventCount: group.eventCount, mentors: [...group.mentors.entries()].map(([id, name]) => ({ id, name })), studentCount: group.studentIds.size, firstSession: group.firstSession, lastSession: group.lastSession, subjectIds: [...group.subjectIds], subjectNames: [...group.subjectNames], mappingStatus, payrollPlan: mapping?.payrollPlan || null, eventIds: group.eventIds };
  });
  const summary = { total: allRows.filter((row) => row.classId).length, mapped: allRows.filter((row) => row.mappingStatus === 'MAPPED').length, unmapped: allRows.filter((row) => row.mappingStatus === 'UNMAPPED').length, needsReview: allRows.filter((row) => row.mappingStatus === 'NEEDS_REVIEW').length, missingClassId: allRows.filter((row) => !row.classId).length };
  const rows = allRows.filter((row) => {
    const matchesSearch = !search || row.title.toLowerCase().includes(search) || (row.classId || '').toLowerCase().includes(search);
    const matchesStatus = !status || row.mappingStatus === status;
    const matchesPlan = !payrollPlanId || row.payrollPlan?.id === payrollPlanId;
    return matchesSearch && matchesStatus && matchesPlan;
  }).sort((a, b) => b.lastSession.getTime() - a.lastSession.getTime());
  const start = (page - 1) * pageSize;
  return NextResponse.json({ success: true, summary, total: rows.length, page, pageSize, rows: rows.slice(start, start + pageSize) });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, 'payroll_rules', 'edit');
  if (denied) return denied;
  const user = await getSessionUserAsync(req);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const classId = text(body.classId);
  const payrollPlanId = text(body.payrollPlanId);
  const displayTitle = text(body.displayTitle);
  if (!classId) return NextResponse.json({ success: false, error: 'A Classcard class ID is required.' }, { status: 400 });
  if (!payrollPlanId) return NextResponse.json({ success: false, error: 'Select an existing payroll plan.' }, { status: 400 });
  const plan = await prisma.payrollPlan.findFirst({ where: { id: payrollPlanId, isActive: true }, select: { id: true, name: true, code: true } });
  if (!plan) return NextResponse.json({ success: false, error: 'The selected payroll plan does not exist or is inactive.' }, { status: 400 });
  const mapping = await prisma.classcardClassMapping.upsert({
    where: { gibbonCourseClassId: classId },
    create: { gibbonCourseClassId: classId, displayTitle: displayTitle || null, payrollPlanId: plan.id, status: 'MAPPED', mappedById: user?.id, mappedAt: new Date() },
    update: { displayTitle: displayTitle || null, payrollPlanId: plan.id, status: 'MAPPED', mappedById: user?.id, mappedAt: new Date() },
    include: { payrollPlan: { select: { id: true, name: true, code: true } } },
  });
  if (user) await prisma.auditEvent.create({ data: { id: crypto.randomUUID(), userId: user.id, action: 'CLASSCARD_CLASS_PAYROLL_PLAN_MAPPED', entityType: 'ClasscardClassMapping', entityId: mapping.id, details: `Mapped Classcard class ${classId} to payroll plan ${plan.code}.` } });
  return NextResponse.json({ success: true, mapping });
}
