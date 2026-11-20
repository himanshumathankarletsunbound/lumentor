import { readFileSync } from "node:fs";
import type { ClassStatus } from "@prisma/client";

const DEFAULT_SOURCE_FILE = "Mentor Compensation Plans.csv";
const IMPORT_TAG = "Imported from Mentor Compensation Plans CSV";

type CsvRow = {
  line: number;
  name: string;
  sourceCode: string;
  rate: number;
  groupMultiplier: number;
  minimumDuration: number;
  lateCancellationPayPercent: number;
};

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

function numberValue(raw: string, label: string, line: number): number {
  const value = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `CSV line ${line}: ${label} must be a non-negative number.`,
    );
  }
  return value;
}

function readRows(sourceFile: string): CsvRow[] {
  const rows = parseCsv(
    readFileSync(sourceFile, "utf8").replace(/^\uFEFF/, ""),
  );
  const [header, ...data] = rows;
  const required = [
    "Plan Name",
    "Plan Code",
    "Compensation Model",
    "Rate per Completed Class",
    "Group Multiplier",
    "Min Duration",
    "Late Cancel Pay",
  ];
  if (!header || required.some((field, index) => header[index] !== field)) {
    throw new Error(`Expected CSV headers: ${required.join(", ")}`);
  }

  return data.flatMap((columns, index) => {
    const line = index + 2;
    if (columns.every((column) => !column.trim())) return [];
    if (columns.length !== required.length)
      throw new Error(`CSV line ${line}: expected ${required.length} columns.`);
    if (columns[2].trim() !== "Per Completed Class") {
      throw new Error(
        `CSV line ${line}: unsupported Compensation Model "${columns[2]}".`,
      );
    }
    const name = columns[0].trim();
    const sourceCode = columns[1].trim().toUpperCase();
    if (!name || !sourceCode)
      throw new Error(
        `CSV line ${line}: Plan Name and Plan Code are required.`,
      );
    return [
      {
        line,
        name,
        sourceCode,
        rate: numberValue(columns[3], "Rate per Completed Class", line),
        groupMultiplier: numberValue(columns[4], "Group Multiplier", line),
        minimumDuration: numberValue(columns[5], "Min Duration", line),
        lateCancellationPayPercent: numberValue(
          columns[6],
          "Late Cancel Pay",
          line,
        ),
      },
    ];
  });
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function identity(
  row: Pick<
    CsvRow,
    | "name"
    | "sourceCode"
    | "rate"
    | "groupMultiplier"
    | "minimumDuration"
    | "lateCancellationPayPercent"
  >,
): string {
  return [
    normalized(row.name),
    normalized(row.sourceCode),
    row.rate,
    row.groupMultiplier,
    row.minimumDuration,
    row.lateCancellationPayPercent,
  ].join("|");
}

function importMarker(row: CsvRow, sourceFile: string): string {
  return `${IMPORT_TAG}; source file: ${sourceFile}; source line ${row.line}; source Plan Code: ${row.sourceCode}; source identity: ${identity(row)}.`;
}

function initialPlanCode(row: CsvRow, occurrences: number): string {
  return occurrences === 1 ? row.sourceCode : `${row.sourceCode}-${row.line}`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const sourceFile =
    process.argv.find(
      (argument) =>
        !argument.startsWith("--") &&
        argument !== process.argv[0] &&
        argument !== process.argv[1],
    ) || DEFAULT_SOURCE_FILE;
  loadEnvironment();
  const rows = readRows(sourceFile);
  const sourceRowsByIdentity = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = identity(row);
    sourceRowsByIdentity.set(key, [
      ...(sourceRowsByIdentity.get(key) || []),
      row,
    ]);
  }
  const uniqueRows = Array.from(
    sourceRowsByIdentity.values(),
    (matchingRows) => matchingRows[0],
  );
  const duplicateSourceRows = rows.length - uniqueRows.length;
  const occurrences = new Map<string, number>();
  for (const row of uniqueRows)
    occurrences.set(row.sourceCode, (occurrences.get(row.sourceCode) || 0) + 1);

  const { prisma } = await import("../src/lib/db/prisma");
  try {
    const organization = await prisma.organization.findFirst({
      select: { id: true, name: true },
    });
    if (!organization)
      throw new Error("No organization exists in the configured database.");

    const existing = await prisma.payrollPlan.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        defaultClassRate: true,
        groupMultiplier: true,
        minEligibleDurationMinutes: true,
        lateCancellationPayPercent: true,
      },
    });
    const codesInUse = new Set(existing.map((plan) => plan.code.toUpperCase()));
    const existingByIdentity = new Map<string, typeof existing>();
    for (const plan of existing) {
      const sourceCode =
        plan.description?.match(/source Plan Code:\s*([^;.]+)/i)?.[1]?.trim() ||
        plan.code.replace(/-CSV(?:-\d+)?$/i, "");
      const key = identity({
        name: plan.name,
        sourceCode,
        rate: Number(plan.defaultClassRate),
        groupMultiplier: Number(plan.groupMultiplier),
        minimumDuration: plan.minEligibleDurationMinutes,
        lateCancellationPayPercent: Number(plan.lateCancellationPayPercent),
      });
      existingByIdentity.set(key, [
        ...(existingByIdentity.get(key) || []),
        plan,
      ]);
    }

    const planned = uniqueRows.map((row) => {
      const matches = existingByIdentity.get(identity(row)) || [];
      let code = initialPlanCode(row, occurrences.get(row.sourceCode) || 1);
      if (matches.length === 0) {
        const base = code;
        let suffix = 1;
        while (codesInUse.has(code.toUpperCase())) {
          code = `${base}-CSV${suffix === 1 ? "" : `-${suffix}`}`;
          suffix += 1;
        }
        codesInUse.add(code.toUpperCase());
      }
      return { row, marker: importMarker(row, sourceFile), matches, code };
    });

    const summary = {
      organization: organization.name,
      sourceRows: rows.length,
      duplicateRowsInSource: duplicateSourceRows,
      existingMatches: planned.filter((item) => item.matches.length > 0).length,
      existingDuplicateMatches: planned.filter(
        (item) => item.matches.length > 1,
      ).length,
      create: planned.filter((item) => item.matches.length === 0).length,
      usesDisambiguatedCodes: planned.filter(
        (item) => item.code !== item.row.sourceCode,
      ).length,
      mode: apply ? "apply" : "preview",
    };
    console.log(JSON.stringify(summary, null, 2));
    if (process.argv.includes("--details")) {
      console.log(
        JSON.stringify(
          {
            sourceDuplicates: Array.from(sourceRowsByIdentity.values())
              .filter((matchingRows) => matchingRows.length > 1)
              .map((matchingRows) => ({
                planName: matchingRows[0].name,
                sourceCode: matchingRows[0].sourceCode,
                lines: matchingRows.map((row) => row.line),
              })),
            existingDuplicates: Array.from(existingByIdentity.values())
              .filter((matchingPlans) => matchingPlans.length > 1)
              .map((matchingPlans) => ({
                planName: matchingPlans[0].name,
                codes: matchingPlans.map((plan) => plan.code),
                ids: matchingPlans.map((plan) => plan.id),
              })),
          },
          null,
          2,
        ),
      );
    }
    if (!apply) {
      console.log(
        "Preview only. Re-run with --apply to write these payroll plans.",
      );
      return;
    }

    await prisma.$transaction(
      async (transaction) => {
        for (const { row, marker, matches, code } of planned) {
          if (matches.length > 0) continue;
          const data = {
            organizationId: organization.id,
            name: row.name,
            code,
            description: marker,
            compensationModel: "PER_CLASS" as const,
            currency: "INR",
            baseSalary: 0,
            defaultClassRate: row.rate,
            hourlyRate: 0,
            perStudentRate: 0,
            revenuePercentage: 0,
            minEligibleDurationMinutes: Math.round(row.minimumDuration),
            payableClassStatuses: [
              "COMPLETED",
              "LATE_CANCELLED",
            ] as ClassStatus[],
            lateCancellationPayPercent: row.lateCancellationPayPercent,
            groupMultiplier: row.groupMultiplier,
            formula: null,
            version: 1,
            effectiveFrom: new Date(),
            effectiveTo: null,
            isActive: true,
          };
          await transaction.payrollPlan.create({ data });
        }
      },
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
