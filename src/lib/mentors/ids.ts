const MENTOR_ID_PATTERN = /^LU-MEM-(\d+)-(\d+)$/;

export function isMentorId(value: string | undefined): boolean {
  return Boolean(value && MENTOR_ID_PATTERN.test(value));
}

export function nextDemoMentorId(existingIds: string[], year = new Date().getFullYear()): string {
  const prefix = `LU-MEM-${year}-`;
  const highest = existingIds.reduce((max, id) => {
    if (!id.startsWith(prefix)) return max;
    const sequence = Number(id.slice(prefix.length));
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${prefix}${highest + 1}`;
}
