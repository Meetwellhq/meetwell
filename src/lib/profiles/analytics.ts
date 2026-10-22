/** Pure helpers for the dashboard Overview charts (no database access, unit-tested). */

const lagosDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
const shortLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });

/** Counts per Lagos calendar day for the last `days` days, oldest first, including empty days. */
export function dailyCounts(times: string[], days: number, now = new Date()): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const t of times) {
    const key = lagosDay.format(new Date(t));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(now.getTime() - (days - 1 - i) * 86_400_000);
    return { label: shortLabel.format(day), value: counts.get(lagosDay.format(day)) ?? 0 };
  });
}

/** Percentage change from the previous period, or null when there's nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Share of `part` in `whole` as a whole percentage (0 when whole is 0). */
export function rate(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
