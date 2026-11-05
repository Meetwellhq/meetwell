import { describe, expect, it } from "vitest";
import {
  bucket,
  dateText,
  daysBetween,
  followUpDue,
  followUpEmail,
  followUpIn,
  hasEmail,
  hasPlaceholder,
  inTab,
  lagosToday,
  outreachWindow,
  partnerEmail,
  radarCsv,
  timing,
  type RadarEvent,
} from "@/lib/radar";

const TODAY = "2026-11-05";
const event = (over: Partial<RadarEvent> = {}): RadarEvent => ({
  id: "2026-11-20-devfest",
  name: "DevFest Lagos",
  start_date: "2026-11-20",
  end_date: "2026-11-20",
  category: "Tech & startup",
  format: "in person",
  venue: "Landmark Centre",
  organizer: "GDG Lagos",
  link: "https://devfest.ng",
  contact: "hi@gdg.ng",
  angle: null,
  hook: null,
  idea: null,
  offer: null,
  subject: null,
  status: "new",
  notes: null,
  source: "manual",
  found_on: "2026-11-01",
  contacted_on: null,
  followed_up_on: null,
  updated_at: "2026-11-01T00:00:00Z",
  ...over,
});
const PITCH = { pitch: "Meetwell is a QR card.", offer: "Free for your guests.", sender: "Rasheed\nFounder" };

describe("radar dates", () => {
  it("uses Lagos time for today", () => {
    expect(lagosToday(new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-06");
    expect(lagosToday(new Date("2026-11-05T22:30:00Z"))).toBe("2026-11-05");
  });

  it("counts days and the outreach window", () => {
    expect(daysBetween(TODAY, "2026-11-20")).toBe(15);
    expect(daysBetween(TODAY, "2026-11-01")).toBe(-4);
    expect(outreachWindow(TODAY)).toEqual({ from: "2026-11-15", to: "2026-11-29" });
  });

  it("says how soon an event is", () => {
    expect(timing(event(), TODAY).tone).toBe("good");
    expect(timing(event({ start_date: "2026-11-08", end_date: "2026-11-08" }), TODAY).text).toBe("3 days away · late, call them");
    expect(timing(event({ start_date: "2026-12-20", end_date: "2026-12-20" }), TODAY).tone).toBe("early");
    expect(timing(event({ start_date: "2026-11-01", end_date: "2026-11-02" }), TODAY).text).toBe("Finished");
  });

  it("writes the date for the email", () => {
    expect(dateText(event())).toBe("Friday 20 November");
    expect(dateText(event({ end_date: "2026-11-22" }))).toBe("20 to 22 November");
    expect(dateText(event({ start_date: "2026-11-30", end_date: "2026-12-02" }))).toBe("30 November to 2 December");
  });
});

describe("radar stages and follow-ups", () => {
  it("puts each event in one tab", () => {
    expect(bucket(event(), TODAY)).toBe("todo");
    expect(bucket(event({ status: "talking" }), TODAY)).toBe("active");
    expect(bucket(event({ status: "declined" }), TODAY)).toBe("done");
    expect(bucket(event({ start_date: "2026-11-01", end_date: "2026-11-01", status: "talking" }), TODAY)).toBe("past");
    expect(inTab(event(), "all", TODAY)).toBe(true);
  });

  it("makes the follow-up due 3 days after the first email, once", () => {
    const sent = event({ status: "contacted", contacted_on: "2026-11-03" });
    expect(followUpIn(sent, TODAY)).toBe(1);
    expect(followUpDue(sent, TODAY)).toBe(false);
    expect(followUpDue(sent, "2026-11-06")).toBe(true);
    expect(inTab(sent, "followup", "2026-11-06")).toBe(true);
    expect(followUpIn({ ...sent, followed_up_on: "2026-11-06" }, "2026-11-07")).toBeNull();
    expect(followUpIn({ ...sent, status: "talking" }, "2026-11-07")).toBeNull();
  });

  it("knows a real email address", () => {
    expect(hasEmail(event())).toBe(true);
    expect(hasEmail(event({ contact: "Instagram DM" }))).toBe(false);
    expect(hasEmail(event({ contact: null }))).toBe(false);
  });
});

describe("radar emails", () => {
  it("drafts the partner email from the pitch and the event's own lines", () => {
    const { subject, body } = partnerEmail(event({ hook: "DevFest is the biggest dev day in Lagos." }), PITCH);
    expect(subject).toBe("Partnership idea for DevFest Lagos");
    expect(body).toContain("Hello GDG Lagos team,");
    expect(body).toContain("DevFest is the biggest dev day in Lagos.");
    expect(body).toContain("Meetwell is a QR card.");
    expect(body).toContain("takes place on Friday 20 November");
    expect(body).toContain('reply "No thanks"');
    expect(body).toContain("Rasheed\nFounder\nmeetwell.me");
    expect(hasPlaceholder(body)).toBe(false);
  });

  it("highlights what's missing until the pitch is written", () => {
    const { body } = partnerEmail(event({ organizer: null }), { pitch: "", offer: "", sender: "" });
    expect(body).toContain("Hello there,");
    expect(hasPlaceholder(body)).toBe(true);
  });

  it("replies in the same thread for the follow-up", () => {
    const { subject, body } = followUpEmail(event({ subject: "Meetwell x DevFest" }), PITCH);
    expect(subject).toBe("Re: Meetwell x DevFest");
    expect(body).toContain("check in on my last email");
  });
});

describe("radar CSV", () => {
  it("quotes cells and stops formulas", () => {
    const csv = radarCsv([event({ notes: '=HYPERLINK("x") said "hi"' })], TODAY);
    const [head, row] = csv.split("\r\n");
    expect(head.startsWith('"Event","Start date"')).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""x"") said ""hi"""`);
    expect(row).toContain('"15"');
  });
});
