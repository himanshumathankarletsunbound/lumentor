import { NextRequest, NextResponse } from "next/server";
import {
  authorizationErrorAsync,
  getSessionUserAsync,
} from "../../../../lib/auth/server";
import { ensureServerPersistence } from "../../../../lib/db/server-initialization";
import { prisma } from "../../../../lib/db/prisma";

type RawRecord = Record<string, unknown>;

function object(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function rawClassId(payload: unknown): string {
  const record = object(payload);
  const classRecord = object(record.class);
  return text(
    record.gibbonCourseClassID ||
      record.gibbonCourseClassId ||
      classRecord.gibbonCourseClassID ||
      classRecord.gibbonCourseClassId,
  );
}

function rawTitle(payload: unknown): string {
  const record = object(payload);
  return text(record.title || record.name || object(record.event).title);
}

function titleKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function eventTitle(event: {
  rawPayload: unknown;
  subjectName?: string | null;
}): string {
  return rawTitle(event.rawPayload) || text(event.subjectName);
}

function rawStudentIds(payload: unknown): string[] {
  const record = object(payload);
  const values =
    record.studentDetails || record.student_details || record.students;
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map(object)
        .map((student) =>
          text(student.user_detail_id || student.student_id || student.user_id),
        )
        .filter(Boolean),
    ),
  ];
}

export async function GET(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "payroll_rules", "view");
  if (denied) return denied;

  const url = new URL(req.url);
  const requestedClassId = text(url.searchParams.get("classId"));
  const requestedTitle = text(url.searchParams.get("title"));
  const search = text(url.searchParams.get("search")).toLowerCase();
  const status = text(url.searchParams.get("status"));
  const mentorId = text(url.searchParams.get("mentorId"));
  const payrollPlanId = text(url.searchParams.get("payrollPlanId"));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(
    100,
    Math.max(10, Number(url.searchParams.get("pageSize") || 25)),
  );
  const exportAll = url.searchParams.get("export") === "1";

  // Details are a targeted, indexed lookup. The paginated list below still
  // aggregates all titles, but opening one title must never scan every event.
  if (requestedTitle || requestedClassId) {
    const normalizedTitle = requestedTitle ? titleKey(requestedTitle) : "";
    let matchingEvents = requestedTitle
      ? await prisma.classcardEvent.findMany({
          where: { titleKey: normalizedTitle },
          orderBy: { startTime: "desc" },
          select: {
            externalId: true,
            gibbonCourseClassId: true,
            subjectExternalId: true,
            subjectName: true,
            classcardTitle: true,
            startTime: true,
            endTime: true,
            rawPayload: true,
            mentor: { select: { id: true, firstName: true, lastName: true } },
          },
        })
      : await prisma.classcardEvent.findMany({
          where: { gibbonCourseClassId: requestedClassId },
          orderBy: { startTime: "desc" },
          select: {
            externalId: true,
            gibbonCourseClassId: true,
            subjectExternalId: true,
            subjectName: true,
            classcardTitle: true,
            startTime: true,
            endTime: true,
            rawPayload: true,
            mentor: { select: { id: true, firstName: true, lastName: true } },
          },
        });
    // Backward-compatible one-time fallback while existing events are being
    // backfilled with the new indexed title key.
    if (requestedTitle && matchingEvents.length === 0) {
      const legacyEvents = await prisma.classcardEvent.findMany({
        where: { titleKey: null },
        select: {
          externalId: true,
          gibbonCourseClassId: true,
          subjectExternalId: true,
          subjectName: true,
          classcardTitle: true,
          startTime: true,
          endTime: true,
          rawPayload: true,
          mentor: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      matchingEvents = legacyEvents.filter(
        (event) => titleKey(eventTitle(event)) === normalizedTitle,
      );
    }
    const resolvedTitle =
      requestedTitle ||
      matchingEvents[0]?.classcardTitle ||
      eventTitle(matchingEvents[0] || { rawPayload: {}, subjectName: "" });
    const [mapping, legacyMapping] = await Promise.all([
      resolvedTitle
        ? prisma.classcardTitleMapping.findUnique({
            where: { normalizedTitle: titleKey(resolvedTitle) },
            include: {
              payrollPlan: { select: { id: true, name: true, code: true } },
            },
          })
        : Promise.resolve(null),
      requestedClassId
        ? prisma.classcardClassMapping.findUnique({
            where: { gibbonCourseClassId: requestedClassId },
            include: {
              payrollPlan: { select: { id: true, name: true, code: true } },
            },
          })
        : Promise.resolve(null),
    ]);
    const resolvedClassId =
      matchingEvents[0]?.gibbonCourseClassId || requestedClassId || null;
    const effectiveMapping = mapping || legacyMapping;
    return NextResponse.json({
      success: true,
      detail: {
        classId: resolvedClassId,
        title: resolvedTitle,
        mapping: effectiveMapping
          ? {
              payrollPlanId: effectiveMapping.payrollPlanId,
              payrollPlan: effectiveMapping.payrollPlan,
              status: effectiveMapping.status,
              displayTitle: effectiveMapping.displayTitle,
            }
          : null,
        events: matchingEvents.map((event) => ({
          externalId: event.externalId,
          title: event.classcardTitle || eventTitle(event),
          startTime: event.startTime,
          endTime: event.endTime,
          subjectExternalId: event.subjectExternalId,
          subjectName: event.subjectName,
          mentor: event.mentor
            ? `${event.mentor.firstName} ${event.mentor.lastName}`.trim()
            : null,
          studentIds: rawStudentIds(event.rawPayload),
        })),
      },
    });
  }

  const events = await prisma.classcardEvent.findMany({
    where: mentorId ? { mentorId } : undefined,
    orderBy: { startTime: "desc" },
    select: {
      externalId: true,
      gibbonCourseClassId: true,
      subjectExternalId: true,
      subjectName: true,
      classcardTitle: true,
      titleKey: true,
      startTime: true,
      endTime: true,
      rawPayload: true,
      mentor: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  const mappings = await prisma.classcardClassMapping.findMany({
    include: { payrollPlan: { select: { id: true, name: true, code: true } } },
  });
  const mappingByClassId = new Map(
    mappings.map((mapping) => [mapping.gibbonCourseClassId, mapping]),
  );
  const titleMappings = await prisma.classcardTitleMapping.findMany({
    include: { payrollPlan: { select: { id: true, name: true, code: true } } },
  });
  const mappingByTitle = new Map(
    titleMappings.map((mapping) => [mapping.normalizedTitle, mapping]),
  );

  const groups = new Map<
    string,
    {
      classId: string | null;
      classIds: Set<string>;
      title: string;
      titles: Set<string>;
      eventCount: number;
      mentors: Map<string, string>;
      studentIds: Set<string>;
      firstSession: Date;
      lastSession: Date;
      subjectIds: Set<string>;
      subjectNames: Set<string>;
      eventIds: string[];
    }
  >();
  for (const event of events) {
    const classId = event.gibbonCourseClassId || rawClassId(event.rawPayload);
    const title = eventTitle(event);
    // A title is the payroll mapping key. Classcard may split the same class
    // across session ranges, but its payout plan must remain consistent.
    const key = title
      ? `title:${titleKey(title)}`
      : classId
        ? `class:${classId}`
        : `missing:${event.externalId}`;
    const group = groups.get(key) || {
      classId: classId || null,
      classIds: new Set<string>(),
      title,
      titles: new Set<string>(),
      eventCount: 0,
      mentors: new Map<string, string>(),
      studentIds: new Set<string>(),
      firstSession: event.startTime,
      lastSession: event.startTime,
      subjectIds: new Set<string>(),
      subjectNames: new Set<string>(),
      eventIds: [],
    };
    if (title) group.titles.add(title);
    if (classId) group.classIds.add(classId);
    if (!group.title && title) group.title = title;
    group.eventCount++;
    group.eventIds.push(event.externalId);
    if (event.mentor)
      group.mentors.set(
        event.mentor.id,
        `${event.mentor.firstName} ${event.mentor.lastName}`.trim(),
      );
    rawStudentIds(event.rawPayload).forEach((id) => group.studentIds.add(id));
    if (event.subjectExternalId) group.subjectIds.add(event.subjectExternalId);
    if (event.subjectName) group.subjectNames.add(event.subjectName);
    if (event.startTime < group.firstSession)
      group.firstSession = event.startTime;
    if (event.startTime > group.lastSession)
      group.lastSession = event.startTime;
    groups.set(key, group);
  }

  const allRows = [...groups.values()].map((group) => {
    const mapping =
      mappingByTitle.get(titleKey(group.title)) ||
      (group.classId ? mappingByClassId.get(group.classId) : undefined);
    const needsReview = !group.title;
    const mappingStatus = needsReview
      ? "NEEDS_REVIEW"
      : mapping?.status || "UNMAPPED";
    return {
      classId: group.classId,
      classIds: [...group.classIds],
      title: group.title || "Untitled event",
      titles: [...group.titles],
      eventCount: group.eventCount,
      mentors: [...group.mentors.entries()].map(([id, name]) => ({ id, name })),
      studentCount: group.studentIds.size,
      firstSession: group.firstSession,
      lastSession: group.lastSession,
      subjectIds: [...group.subjectIds],
      subjectNames: [...group.subjectNames],
      mappingStatus,
      payrollPlan: mapping?.payrollPlan || null,
      eventIds: group.eventIds,
    };
  });
  const summary = {
    total: allRows.filter((row) => row.classId).length,
    mapped: allRows.filter((row) => row.mappingStatus === "MAPPED").length,
    unmapped: allRows.filter((row) => row.mappingStatus === "UNMAPPED").length,
    needsReview: allRows.filter((row) => row.mappingStatus === "NEEDS_REVIEW")
      .length,
    missingClassId: allRows.filter((row) => !row.classId).length,
  };
  const rows = allRows
    .filter((row) => {
      const matchesSearch =
        !search ||
        row.title.toLowerCase().includes(search) ||
        (row.classId || "").toLowerCase().includes(search);
      const matchesStatus = !status || row.mappingStatus === status;
      const matchesPlan =
        !payrollPlanId || row.payrollPlan?.id === payrollPlanId;
      return matchesSearch && matchesStatus && matchesPlan;
    })
    .sort((a, b) => b.lastSession.getTime() - a.lastSession.getTime());
  const start = (page - 1) * pageSize;
  return NextResponse.json({
    success: true,
    summary,
    total: rows.length,
    page,
    pageSize,
    rows: exportAll ? rows : rows.slice(start, start + pageSize),
  });
}

export async function POST(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "payroll_rules", "edit");
  if (denied) return denied;
  const user = await getSessionUserAsync(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const classId = text(body.classId);
  const requestedTitle = text(body.title);
  const payrollPlanId = text(body.payrollPlanId);
  const displayTitle = text(body.displayTitle);
  if (!classId && !requestedTitle)
    return NextResponse.json(
      { success: false, error: "A Classcard title is required." },
      { status: 400 },
    );
  if (!payrollPlanId)
    return NextResponse.json(
      { success: false, error: "Select an existing payroll plan." },
      { status: 400 },
    );
  const plan = await prisma.payrollPlan.findFirst({
    where: { id: payrollPlanId, isActive: true },
    select: { id: true, name: true, code: true },
  });
  if (!plan)
    return NextResponse.json(
      {
        success: false,
        error: "The selected payroll plan does not exist or is inactive.",
      },
      { status: 400 },
    );
  const canonicalTitle = displayTitle || requestedTitle;
  const titleEvents = await prisma.classcardEvent.findMany({
    where: { titleKey: titleKey(canonicalTitle) },
    select: { gibbonCourseClassId: true },
  });
  const relatedClassIds = [
    ...new Set(
      titleEvents
        .map((event) => event.gibbonCourseClassId)
        .filter((classId): classId is string => Boolean(classId)),
    ),
  ];
  const storedClassIds = (
    await prisma.classcardClassMapping.findMany({
      where: {
        displayTitle: { equals: canonicalTitle, mode: "insensitive" },
      },
      select: { gibbonCourseClassId: true },
    })
  ).map((mapping) => mapping.gibbonCourseClassId);
  const classIds = [
    ...new Set([
      ...(classId ? [classId] : []),
      ...relatedClassIds,
      ...storedClassIds,
    ]),
  ];
  if (!classIds.length)
    return NextResponse.json(
      {
        success: false,
        error: "No Classcard sessions were found for this title.",
      },
      { status: 404 },
    );
  const existingClassMappings = await prisma.classcardClassMapping.findMany({
    where: { gibbonCourseClassId: { in: classIds } },
    select: { gibbonCourseClassId: true },
  });
  const existingClassIds = existingClassMappings.map(
    (mapping) => mapping.gibbonCourseClassId,
  );
  const missingClassIds = classIds.filter(
    (currentClassId) => !existingClassIds.includes(currentClassId),
  );
  const mappedAt = new Date();
  const saved = await prisma.$transaction([
    prisma.classcardTitleMapping.upsert({
      where: { normalizedTitle: titleKey(canonicalTitle) },
      create: {
        normalizedTitle: titleKey(canonicalTitle),
        displayTitle: canonicalTitle,
        payrollPlanId: plan.id,
        status: "MAPPED",
        mappedById: user?.id,
        mappedAt,
      },
      update: {
        displayTitle: canonicalTitle,
        payrollPlanId: plan.id,
        status: "MAPPED",
        mappedById: user?.id,
        mappedAt,
      },
      include: {
        payrollPlan: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.classcardClassMapping.updateMany({
      where: { gibbonCourseClassId: { in: existingClassIds } },
      data: {
        displayTitle: canonicalTitle,
        payrollPlanId: plan.id,
        status: "MAPPED",
        mappedById: user?.id,
        mappedAt,
      },
    }),
    ...missingClassIds.map((currentClassId) =>
      prisma.classcardClassMapping.upsert({
        where: { gibbonCourseClassId: currentClassId },
        create: {
          gibbonCourseClassId: currentClassId,
          displayTitle: canonicalTitle,
          payrollPlanId: plan.id,
          status: "MAPPED",
          mappedById: user?.id,
          mappedAt,
        },
        update: {
          displayTitle: canonicalTitle,
          payrollPlanId: plan.id,
          status: "MAPPED",
          mappedById: user?.id,
          mappedAt,
        },
        include: {
          payrollPlan: { select: { id: true, name: true, code: true } },
        },
      }),
    ),
  ]);
  const mapping = saved[0];
  if (user) {
    try {
      await prisma.auditEvent.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          action: "CLASSCARD_TITLE_PAYROLL_PLAN_MAPPED",
          entityType: "ClasscardTitleMapping",
          entityId: mapping.id,
          details: `Mapped title "${canonicalTitle}" across ${classIds.length} Classcard class ID(s) to payroll plan ${plan.code}.`,
        },
      });
    } catch (error) {
      // A completed mapping must not be reported as failed if only audit
      // logging is unavailable. The primary write is already committed.
      console.error("Unable to audit Classcard title mapping", error);
    }
  }
  return NextResponse.json({
    success: true,
    mapping,
    mappedClassIds: classIds,
  });
}

export async function DELETE(req: NextRequest) {
  await ensureServerPersistence();
  const denied = await authorizationErrorAsync(req, "payroll_rules", "edit");
  if (denied) return denied;

  const url = new URL(req.url);
  const requestedTitle = text(url.searchParams.get("title"));
  const requestedClassId = text(url.searchParams.get("classId"));
  if (!requestedTitle && !requestedClassId) {
    return NextResponse.json(
      { success: false, error: "A Classcard title is required." },
      { status: 400 },
    );
  }

  const [user, titleEvents, storedMappings] = await Promise.all([
    getSessionUserAsync(req),
    requestedTitle
      ? prisma.classcardEvent.findMany({
          where: { titleKey: titleKey(requestedTitle) },
          select: { gibbonCourseClassId: true },
        })
      : Promise.resolve([]),
    prisma.classcardClassMapping.findMany({
      select: { id: true, gibbonCourseClassId: true, displayTitle: true },
    }),
  ]);
  const relatedClassIds = requestedTitle
    ? titleEvents
        .map((event) => event.gibbonCourseClassId)
        .filter((classId): classId is string => Boolean(classId))
    : [];
  const storedTitleClassIds = requestedTitle
    ? storedMappings
        .filter(
          (mapping) =>
            titleKey(mapping.displayTitle || "") === titleKey(requestedTitle),
        )
        .map((mapping) => mapping.gibbonCourseClassId)
    : [];
  const classIds = [
    ...new Set([
      ...(requestedClassId ? [requestedClassId] : []),
      ...relatedClassIds,
      ...storedTitleClassIds,
    ]),
  ];
  if (!classIds.length) {
    return NextResponse.json(
      { success: false, error: "No stored Classcard mapping was found." },
      { status: 404 },
    );
  }

  const mappedAt = new Date();
  const [result] = await prisma.$transaction([
    prisma.classcardClassMapping.updateMany({
      where: { gibbonCourseClassId: { in: classIds } },
      data: {
        payrollPlanId: null,
        status: "UNMAPPED",
        mappedById: user?.id,
        mappedAt,
      },
    }),
    prisma.classcardTitleMapping.upsert({
      where: { normalizedTitle: titleKey(requestedTitle || requestedClassId) },
      create: {
        normalizedTitle: titleKey(requestedTitle || requestedClassId),
        displayTitle: requestedTitle || requestedClassId,
        status: "UNMAPPED",
        mappedById: user?.id,
        mappedAt,
      },
      update: {
        payrollPlanId: null,
        status: "UNMAPPED",
        mappedById: user?.id,
        mappedAt,
      },
    }),
  ]);
  if (user) {
    try {
      await prisma.auditEvent.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          action: "CLASSCARD_TITLE_PAYROLL_PLAN_UNMAPPED",
          entityType: "ClasscardTitleMapping",
          entityId: requestedTitle || requestedClassId,
          details: `Unmapped payroll plan from title "${requestedTitle || requestedClassId}" across ${result.count} Classcard class ID(s).`,
        },
      });
    } catch (error) {
      console.error("Unable to audit Classcard title unmapping", error);
    }
  }
  return NextResponse.json({
    success: true,
    unmappedClassIds: classIds,
    count: result.count,
  });
}
