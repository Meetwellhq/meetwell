import { describe, expect, it } from "vitest";
import { eventCardPath, eventDates, isEventSlug } from "@/lib/events";

describe("eventDates", () => {
  it("writes one day, a few days, across months and across years", () => {
    expect(eventDates("2026-11-20", null)).toBe("20 November 2026");
    expect(eventDates("2026-11-20", "2026-11-20")).toBe("20 November 2026");
    expect(eventDates("2026-11-20", "2026-11-21")).toBe("20–21 November 2026");
    expect(eventDates("2026-11-30", "2026-12-01")).toBe("30 November – 1 December 2026");
    expect(eventDates("2026-12-31", "2027-01-01")).toBe("31 December 2026 – 1 January 2027");
  });
});

describe("event links", () => {
  it("accepts only the link names the database accepts", () => {
    expect(isEventSlug("thinkux-2026")).toBe(true);
    expect(isEventSlug("tc")).toBe(false);
    expect(isEventSlug("Bad Slug")).toBe(false);
    expect(isEventSlug("a--b")).toBe(false);
    expect(isEventSlug(["thinkux"])).toBe(false);
    expect(isEventSlug(undefined)).toBe(false);
  });

  it("keeps the event on a speaker's card link", () => {
    expect(eventCardPath("ada", "thinkux-2026")).toBe("/p/ada?event=thinkux-2026");
  });
});
