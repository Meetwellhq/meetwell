import { describe, expect, it } from "vitest";
import { dailyCounts, percentChange, rate } from "@/lib/profiles/analytics";

describe("dashboard analytics", () => {
  it("counts views per Lagos day, oldest first, with empty days", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    // 23:30 UTC on 20 Oct is already 21 Oct in Lagos (UTC+1).
    const points = dailyCounts(["2026-10-22T08:00:00Z", "2026-10-22T09:00:00Z", "2026-10-20T23:30:00Z"], 3, now);
    expect(points).toEqual([
      { label: "20 Oct", value: 0 },
      { label: "21 Oct", value: 1 },
      { label: "22 Oct", value: 2 },
    ]);
  });

  it("compares with the period before", () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(3, 0)).toBeNull();
  });

  it("works out a share safely", () => {
    expect(rate(1, 4)).toBe(25);
    expect(rate(3, 0)).toBe(0);
  });
});
