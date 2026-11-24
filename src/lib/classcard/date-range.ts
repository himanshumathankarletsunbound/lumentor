/**
 * Classcard queries are calendar-date based, while event timestamps are UTC
 * instants. Keep range checks in the event's declared Classcard timezone so a
 * 05:00 Asia/Calcutta event is retained for its local calendar day instead of
 * being incorrectly treated as the previous UTC day.
 */
export function classcardDatePart(
  value: unknown,
  timezone?: string | null,
): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // Attendance's `date` field is already a calendar date. Parsing it as UTC
  // and formatting it in another timezone would shift it back a day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const instant = new Date(raw);
  if (Number.isNaN(instant.getTime())) return null;

  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(instant);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((item) => item.type === type)?.value;
      const year = part("year");
      const month = part("month");
      const day = part("day");
      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // Invalid/missing timezone metadata falls back to the timestamp date.
    }
  }

  return instant.toISOString().slice(0, 10);
}

export function isClasscardDateInRange(
  value: unknown,
  start: string,
  end: string,
  timezone?: string | null,
): boolean {
  const datePart = classcardDatePart(value, timezone);
  return Boolean(datePart && datePart >= start && datePart <= end);
}
