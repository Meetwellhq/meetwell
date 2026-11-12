import { describe, expect, it } from "vitest";
import { bucket, byDeadline, closingSoon, deadlineText, inTab, type Funding } from "@/lib/funding";

const TODAY = "2026-11-12";
const f = (over: Partial<Funding>): Funding => ({
  id: "x",
  name: "X",
  funder: null,
  kind: "grant",
  amount: null,
  equity_free: null,
  deadline: null,
  region: "Africa",
  link: null,
  eligibility: null,
  fit: null,
  prepare: null,
  status: "new",
  notes: null,
  source: "weekly-search",
  found_on: TODAY,
  applied_on: null,
  updated_at: TODAY,
  ...over,
});

describe("funding radar tabs", () => {
  it("puts each opportunity in one place", () => {
    expect(bucket(f({}), TODAY)).toBe("review");
    expect(bucket(f({ status: "preparing", deadline: "2026-12-01" }), TODAY)).toBe("preparing");
    expect(bucket(f({ status: "shortlisted" }), TODAY)).toBe("applied");
    expect(bucket(f({ status: "won" }), TODAY)).toBe("done");
    expect(bucket(f({ status: "skipped" }), TODAY)).toBe("done");
    expect(bucket(f({ deadline: "2026-11-11" }), TODAY)).toBe("closed");
    // Applied before it closed: still under Applied
    expect(bucket(f({ status: "applied", deadline: "2026-11-01" }), TODAY)).toBe("applied");
  });

  it("flags deadlines within two weeks that haven't been applied to", () => {
    expect(closingSoon(f({ deadline: "2026-11-26" }), TODAY)).toBe(true);
    expect(closingSoon(f({ deadline: "2026-11-27" }), TODAY)).toBe(false);
    expect(closingSoon(f({ deadline: "2026-11-12", status: "preparing" }), TODAY)).toBe(true);
    expect(closingSoon(f({ deadline: "2026-11-20", status: "applied" }), TODAY)).toBe(false);
    expect(closingSoon(f({ deadline: "2026-11-11" }), TODAY)).toBe(false);
    expect(closingSoon(f({}), TODAY)).toBe(false);
    expect(inTab(f({ deadline: "2026-11-20" }), "soon", TODAY)).toBe(true);
    expect(inTab(f({ status: "won" }), "all", TODAY)).toBe(true);
  });
});

describe("deadlineText", () => {
  it("says how long is left", () => {
    expect(deadlineText({ deadline: null }, TODAY)).toEqual({ tone: "rolling", text: "Rolling or no date yet" });
    expect(deadlineText({ deadline: "2026-11-10" }, TODAY)).toEqual({ tone: "past", text: "Closed 10 Nov" });
    expect(deadlineText({ deadline: "2026-11-12" }, TODAY)).toEqual({ tone: "late", text: "Closes today" });
    expect(deadlineText({ deadline: "2026-11-13" }, TODAY)).toEqual({ tone: "late", text: "Closes in 1 day · 13 Nov" });
    expect(deadlineText({ deadline: "2026-11-24" }, TODAY)).toEqual({ tone: "soon", text: "Closes in 12 days · 24 Nov" });
    expect(deadlineText({ deadline: "2027-01-15" }, TODAY)).toEqual({ tone: "fine", text: "Closes 15 Jan · 64 days" });
  });

  it("sorts nearest deadline first, rolling last", () => {
    const list = [f({ name: "B" }), f({ name: "C", deadline: "2027-01-01" }), f({ name: "A", deadline: "2026-12-01" }), f({ name: "A2" })];
    expect(list.sort(byDeadline).map((x) => x.name)).toEqual(["A", "C", "A2", "B"]);
  });
});
