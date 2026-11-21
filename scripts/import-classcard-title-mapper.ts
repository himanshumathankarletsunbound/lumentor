import { readFileSync } from "node:fs";

const DEFAULT_SOURCE_FILE = "Classcard Title Mapper.csv";

type SourceRow = {
  line: number;
  title: string;
  payrollPlanName: string;
  payrollPlanCode: string;
};

type RawRecord = Record<string, unknown>;

function loadEnvironment(): void {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (value || row.length) rows.push([...row, value.replace(/\r$/, "")]);
  return rows;
}

function key(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

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

function readRows(sourceFile: string): SourceRow[] {
  const [header, ...data] = parseCsv(
    readFileSync(sourceFile, "utf8").replace(/^\uFEFF/, ""),
  );
  const expected = ["Class title", "payroll plan name", "Plan Code"];
  if (
    !header ||
    expected.some((field, index) => key(header[index]) !== key(field))
  ) {
    throw new Error(`Expected CSV headers: ${expected.join(", ")}`);
  }

  return data.flatMap((columns, index) => {
    if (columns.every((column) => !column.trim())) return [];
    const line = index + 2;
    if (columns.length !== 3) {
      throw new Error(`CSV line ${line}: expected exactly 3 columns.`);
    }
    const title = columns[0].trim();
    if (!title) throw new Error(`CSV line ${line}: Class title is required.`);
    return [
      {
        line,
        title,
        payrollPlanName: columns[1].trim(),
        payrollPlanCode: columns[2].trim().toUpperCase(),
      },
    ];
  });
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const details = process.argv.includes("--details");
  const sourceFile =
    process.argv.find(
      (argument) =>
        !argument.startsWith("--") &&
        argument !== process.argv[0] &&
        argument !== process.argv[1],
    ) || DEFAULT_SOURCE_FILE;
  loadEnvironment();
  const rows = readRows(sourceFile);
  const { prisma } = await import("../src/lib/db/prisma");

  try {
    const [plans, events, existingMappings] = await Promise.all([
      prisma.payrollPlan.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      prisma.classcardEvent.findMany({
        select: {
          gibbonCourseClassId: true,
          subjectName: true,
          rawPayload: true,
        },
      }),
      prisma.classcardClassMapping.findMany({
        select: {
          gibbonCourseClassId: true,
          payrollPlanId: true,
          displayTitle: true,
          status: true,
        },
      }),
    ]);
    const plansByName = new Map<string, typeof plans>();
    for (const plan of plans) {
      const planKey = key(plan.name);
      plansByName.set(planKey, [...(plansByName.get(planKey) || []), plan]);
    }
    const classIdsByTitle = new Map<string, Set<string>>();
    for (const event of events) {
      const title = rawTitle(event.rawPayload) || text(event.subjectName);
      const classId = event.gibbonCourseClassId || rawClassId(event.rawPayload);
      if (!title || !classId) continue;
      const titleKey = key(title);
      const classIds = classIdsByTitle.get(titleKey) || new Set<string>();
      classIds.add(classId);
      classIdsByTitle.set(titleKey, classIds);
    }

    const rowsByTitle = new Map<string, SourceRow[]>();
    for (const row of rows) {
      const titleKey = key(row.title);
      rowsByTitle.set(titleKey, [...(rowsByTitle.get(titleKey) || []), row]);
    }
    const duplicateTitles = Array.from(rowsByTitle.values()).filter(
      (matchingRows) => matchingRows.length > 1,
    );
    const conflictingTitles = new Set(
      duplicateTitles
        .filter(
          (matchingRows) =>
            new Set(
              matchingRows.map(
                (row) => `${key(row.payrollPlanName)}|${row.payrollPlanCode}`,
              ),
            ).size > 1,
        )
        .map((matchingRows) => key(matchingRows[0].title)),
    );
    const uniqueRows = Array.from(
      rowsByTitle.values(),
      (matchingRows) => matchingRows[0],
    );
    const unresolved: Array<{ line: number; title: string; reason: string }> =
      [];
    const planned: Array<{
      row: SourceRow;
      planId: string;
      classIds: string[];
    }> = [];

    for (const row of uniqueRows) {
      if (conflictingTitles.has(key(row.title))) {
        unresolved.push({
          line: row.line,
          title: row.title,
          reason: "The CSV assigns more than one plan to this title.",
        });
        continue;
      }
      if (!row.payrollPlanName) {
        unresolved.push({
          line: row.line,
          title: row.title,
          reason: "No payroll plan was supplied.",
        });
        continue;
      }
      const matchingPlans = plansByName.get(key(row.payrollPlanName)) || [];
      const codeMatchedPlans = row.payrollPlanCode
        ? matchingPlans.filter(
            (plan) => plan.code.toUpperCase() === row.payrollPlanCode,
          )
        : matchingPlans;
      const plan =
        codeMatchedPlans.length === 1
          ? codeMatchedPlans[0]
          : matchingPlans.length === 1
            ? matchingPlans[0]
            : null;
      if (!plan) {
        unresolved.push({
          line: row.line,
          title: row.title,
          reason: matchingPlans.length
            ? "More than one active plan has this exact name; its code did not identify one plan."
            : "No active payroll plan has this exact name.",
        });
        continue;
      }
      const classIds = [...(classIdsByTitle.get(key(row.title)) || [])];
      if (!classIds.length) {
        unresolved.push({
          line: row.line,
          title: row.title,
          reason: "No matching Classcard event title was found.",
        });
        continue;
      }
      planned.push({ row, planId: plan.id, classIds });
    }

    const assignmentsByClassId = new Map<string, typeof planned>();
    for (const assignment of planned) {
      for (const classId of assignment.classIds) {
        assignmentsByClassId.set(classId, [
          ...(assignmentsByClassId.get(classId) || []),
          assignment,
        ]);
      }
    }
    const conflictedAssignments = Array.from(
      assignmentsByClassId.entries(),
    ).filter(([, assignments]) => assignments.length > 1);
    const conflictedClassIds = new Set(
      conflictedAssignments.map(([classId]) => classId),
    );
    const mappings = planned.flatMap((assignment) =>
      assignment.classIds
        .filter((classId) => !conflictedClassIds.has(classId))
        .map((classId) => ({ ...assignment, classId })),
    );
    // A title is authoritative. Classcard IDs are maintained as compatibility
    // mirrors for existing payroll records and integrations.
    const titleMappings = planned.map((assignment) => ({
      normalizedTitle: key(assignment.row.title),
      displayTitle: assignment.row.title,
      payrollPlanId: assignment.planId,
    }));
    const existingByClassId = new Map(
      existingMappings.map((mapping) => [mapping.gibbonCourseClassId, mapping]),
    );
    const created = mappings.filter(
      (mapping) => !existingByClassId.has(mapping.classId),
    ).length;
    const updated = mappings.filter((mapping) => {
      const current = existingByClassId.get(mapping.classId);
      return (
        current &&
        (current.payrollPlanId !== mapping.planId ||
          current.status !== "MAPPED" ||
          key(current.displayTitle || "") !== key(mapping.row.title))
      );
    }).length;
    const unchanged = mappings.length - created - updated;
    const summary = {
      sourceRows: rows.length,
      duplicateTitleRows: rows.length - uniqueRows.length,
      conflictingTitles: conflictingTitles.size,
      titlesWithPlanMappings: new Set(
        titleMappings.map((mapping) => mapping.normalizedTitle),
      ).size,
      authoritativeTitleMappings: titleMappings.length,
      classcardClassMappings: mappings.length,
      create: created,
      update: updated,
      unchanged,
      unresolved: unresolved.length,
      conflictingClassIds: conflictedClassIds.size,
      mode: apply ? "apply" : "preview",
    };
    console.log(JSON.stringify(summary, null, 2));
    if (details) {
      console.log(
        JSON.stringify(
          {
            unresolved: unresolved.slice(0, 100),
            conflictedClassIds: conflictedAssignments.map(
              ([classId, assignments]) => ({
                classId,
                assignments: assignments.map((assignment) => ({
                  title: assignment.row.title,
                  payrollPlanName: assignment.row.payrollPlanName,
                  payrollPlanCode: assignment.row.payrollPlanCode,
                })),
              }),
            ),
          },
          null,
          2,
        ),
      );
    }
    if (!apply) {
      console.log(
        "Preview only. Re-run with --apply to write the validated title mappings.",
      );
      return;
    }

    const mappedAt = new Date();
    await prisma.$transaction(
      [
        ...titleMappings.map((mapping) =>
          prisma.classcardTitleMapping.upsert({
            where: { normalizedTitle: mapping.normalizedTitle },
            create: {
              ...mapping,
              status: "MAPPED",
              mappedAt,
            },
            update: {
              displayTitle: mapping.displayTitle,
              payrollPlanId: mapping.payrollPlanId,
              status: "MAPPED",
              mappedAt,
            },
          }),
        ),
        ...mappings.map((mapping) =>
          prisma.classcardClassMapping.upsert({
            where: { gibbonCourseClassId: mapping.classId },
            create: {
              gibbonCourseClassId: mapping.classId,
              displayTitle: mapping.row.title,
              payrollPlanId: mapping.planId,
              status: "MAPPED",
              mappedAt,
            },
            update: {
              displayTitle: mapping.row.title,
              payrollPlanId: mapping.planId,
              status: "MAPPED",
              mappedAt,
            },
          }),
        ),
      ],
      { timeout: 30_000 },
    );
    console.log(JSON.stringify({ success: true, ...summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
