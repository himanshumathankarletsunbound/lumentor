type RawRecord = Record<string, unknown>;

function object(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeClasscardTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function classcardTitleFromPayload(
  payload: unknown,
  fallback?: string | null,
): string {
  const record = object(payload);
  return (
    text(record.title || record.name || object(record.event).title) ||
    text(fallback)
  );
}
