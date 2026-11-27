export const DATABASE_PENALTY_CATEGORIES = [
  'LATE_CANCELLATION',
  'UNAPPROVED_ABSENCE',
  'MISSING_ATTENDANCE',
  'POLICY_VIOLATION',
  'ADMINISTRATIVE',
  'OTHER',
] as const;

export type DatabasePenaltyCategory = (typeof DATABASE_PENALTY_CATEGORIES)[number];

/** Converts policy codes and display names into the enum stored by Prisma. */
export function normalizePenaltyCategory(...values: Array<string | null | undefined>): DatabasePenaltyCategory {
  const supplied = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const exact = supplied.find((value) =>
    DATABASE_PENALTY_CATEGORIES.includes(value.toUpperCase() as DatabasePenaltyCategory),
  );
  if (exact) return exact.toUpperCase() as DatabasePenaltyCategory;

  const text = supplied.join(' ').toLowerCase();
  if (/cancell?ation|late[ _-]*cancel/.test(text)) return 'LATE_CANCELLATION';
  if (/miss without information|missing attendance|\bmissi\b/.test(text)) return 'MISSING_ATTENDANCE';
  if (/unapproved absence|absence without|absent without/.test(text)) return 'UNAPPROVED_ABSENCE';
  if (/administrative|\badmin\b/.test(text)) return 'ADMINISTRATIVE';
  if (/late joining|demo denied|policy|violation/.test(text)) return 'POLICY_VIOLATION';
  return 'OTHER';
}
