import { readFileSync } from "node:fs";
import {
  classcardTitleFromPayload,
  normalizeClasscardTitle,
} from "../src/lib/classcard/title";

function loadEnvironment(): void {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  loadEnvironment();
  const { prisma } = await import("../src/lib/db/prisma");
  try {
    const [events, legacyMappings] = await Promise.all([
      prisma.classcardEvent.findMany({
        select: { id: true, rawPayload: true, subjectName: true },
      }),
      prisma.classcardClassMapping.findMany({
        where: {
          status: "MAPPED",
          displayTitle: { not: null },
          payrollPlanId: { not: null },
        },
        select: { displayTitle: true, payrollPlanId: true },
      }),
    ]);
    const titleGroups = new Map<
      string,
      { displayTitle: string; payrollPlanIds: Set<string> }
    >();
    for (const mapping of legacyMappings) {
      const displayTitle = mapping.displayTitle?.trim() || "";
      const normalizedTitle = normalizeClasscardTitle(displayTitle);
      if (!normalizedTitle || !mapping.payrollPlanId) continue;
      const group = titleGroups.get(normalizedTitle) || {
        displayTitle,
        payrollPlanIds: new Set<string>(),
      };
      group.payrollPlanIds.add(mapping.payrollPlanId);
      titleGroups.set(normalizedTitle, group);
    }
    const eventUpdates = events.flatMap((event) => {
      const displayTitle = classcardTitleFromPayload(
        event.rawPayload,
        event.subjectName,
      );
      return displayTitle
        ? [
            {
              id: event.id,
              displayTitle,
              titleKey: normalizeClasscardTitle(displayTitle),
            },
          ]
        : [];
    });
    const conflicts = [...titleGroups.entries()].filter(
      ([, group]) => group.payrollPlanIds.size > 1,
    );
    const summary = {
      events: events.length,
      eventTitleKeysToBackfill: eventUpdates.length,
      existingMappedTitles: titleGroups.size,
      consistentTitleMappings: titleGroups.size - conflicts.length,
      conflictingTitleMappings: conflicts.length,
      conflicts: conflicts.map(([normalizedTitle, group]) => ({
        normalizedTitle,
        displayTitle: group.displayTitle,
        payrollPlanCount: group.payrollPlanIds.size,
      })),
      mode: apply ? "apply" : "preview",
    };
    console.log(JSON.stringify(summary, null, 2));
    if (!apply) return;

    const now = new Date();
    // Supabase poolers are sensitive to very large transactions. Keep each
    // title-key backfill chunk short and idempotent.
    for (let start = 0; start < eventUpdates.length; start += 100) {
      const chunk = eventUpdates.slice(start, start + 100);
      await prisma.$transaction(
        chunk.map((event) =>
          prisma.classcardEvent.update({
            where: { id: event.id },
            data: {
              classcardTitle: event.displayTitle,
              titleKey: event.titleKey,
            },
          }),
        ),
        { timeout: 30_000 },
      );
    }
    await prisma.$transaction(
      [...titleGroups.entries()].map(([normalizedTitle, group]) => {
        const planIds = [...group.payrollPlanIds];
        const conflict = planIds.length > 1;
        return prisma.classcardTitleMapping.upsert({
          where: { normalizedTitle },
          create: {
            normalizedTitle,
            displayTitle: group.displayTitle,
            payrollPlanId: conflict ? null : planIds[0],
            status: conflict ? "NEEDS_REVIEW" : "MAPPED",
            mappedAt: now,
          },
          update: {
            displayTitle: group.displayTitle,
            payrollPlanId: conflict ? null : planIds[0],
            status: conflict ? "NEEDS_REVIEW" : "MAPPED",
            mappedAt: now,
          },
        });
      }),
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
