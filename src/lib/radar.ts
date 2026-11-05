/**
 * Partner radar: events found about two weeks ahead, so the founder can ask
 * organisers about Meetwell joining as a partner. Pure helpers (dates, stages,
 * follow-ups and the two emails), unit-tested; the page is /admin/radar.
 */

export const RADAR_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "talking", label: "Talking" },
  { value: "agreed", label: "Agreed" },
  { value: "declined", label: "Declined" },
] as const;
export type RadarStatus = (typeof RADAR_STAGES)[number]["value"];

export const RADAR_CATEGORIES = ["Tech & startup", "Business & networking", "Social & community"] as const;

export type RadarEvent = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  category: string | null;
  format: "in person" | "online";
  venue: string | null;
  organizer: string | null;
  link: string | null;
  contact: string | null;
  angle: string | null;
  hook: string | null;
  idea: string | null;
  offer: string | null;
  subject: string | null;
  status: RadarStatus;
  notes: string | null;
  source: "manual" | "weekly-search";
  found_on: string;
  contacted_on: string | null;
  followed_up_on: string | null;
  updated_at: string;
};

export type RadarPitch = { pitch: string; offer: string; sender: string };

/** Days after the first email before the one follow-up is due. */
export const FOLLOW_UP_DAYS = 3;

/** Today in Lagos, as YYYY-MM-DD. */
export function lagosToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayNumber = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);

/** Whole days from `today` to `iso` (negative when it's past). */
export const daysBetween = (today: string, iso: string) => dayNumber(iso) - dayNumber(today);

export const isPast = (e: RadarEvent, today: string) => daysBetween(today, e.end_date ?? e.start_date) < 0;

export const hasEmail = (e: Pick<RadarEvent, "contact">) => /\S+@\S+\.\S+/.test(e.contact ?? "");

/** Contacted, no reply, no follow-up yet: days until the follow-up is due (0 or less = due now), else null. */
export function followUpIn(e: RadarEvent, today: string): number | null {
  if (e.status !== "contacted" || e.followed_up_on || !e.contacted_on || isPast(e, today)) return null;
  return FOLLOW_UP_DAYS + daysBetween(today, e.contacted_on);
}

export const followUpDue = (e: RadarEvent, today: string) => {
  const d = followUpIn(e, today);
  return d !== null && d <= 0;
};

export type RadarTab = "followup" | "todo" | "active" | "done" | "past" | "all";
export const RADAR_TABS: { value: RadarTab; label: string }[] = [
  { value: "followup", label: "Follow up" },
  { value: "todo", label: "To contact" },
  { value: "active", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

export function bucket(e: RadarEvent, today: string): Exclude<RadarTab, "followup" | "all"> {
  if (isPast(e, today)) return "past";
  if (e.status === "agreed" || e.status === "declined") return "done";
  if (e.status === "contacted" || e.status === "talking") return "active";
  return "todo";
}

export const inTab = (e: RadarEvent, tab: RadarTab, today: string) =>
  tab === "all" || (tab === "followup" ? followUpDue(e, today) : bucket(e, today) === tab);

/** How soon it is, and whether that's a good time to write. */
export function timing(e: RadarEvent, today: string): { tone: "past" | "late" | "good" | "early"; text: string } {
  if (isPast(e, today)) return { tone: "past", text: "Finished" };
  const d = daysBetween(today, e.start_date);
  if (d <= 0) return { tone: "late", text: "Happening now" };
  if (d < 7) return { tone: "late", text: `${d} day${d === 1 ? "" : "s"} away · late, call them` };
  if (d <= 24) return { tone: "good", text: `${d} days away · good time to reach out` };
  return { tone: "early", text: `${d} days away · early` };
}

const parse = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => parse(iso).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });

export const shortDate = (iso: string) => fmt(iso, { day: "numeric", month: "short" });

/** "Thursday 12 November", or "13 to 15 November" for a run of days. */
export function dateText(e: Pick<RadarEvent, "start_date" | "end_date">) {
  const { start_date: s, end_date: en } = e;
  if (!en || en === s) return fmt(s, { weekday: "long", day: "numeric", month: "long" });
  return s.slice(0, 7) === en.slice(0, 7)
    ? `${+s.slice(8, 10)} to ${fmt(en, { day: "numeric", month: "long" })}`
    : `${fmt(s, { day: "numeric", month: "long" })} to ${fmt(en, { day: "numeric", month: "long" })}`;
}

/** The outreach window: events 10 to 24 days from today. */
export function outreachWindow(today: string) {
  const at = (n: number) => new Date(dayNumber(today) * 864e5 + n * 864e5).toISOString().slice(0, 10);
  return { from: at(10), to: at(24) };
}

/** Placeholders shown, highlighted, until the pitch is filled in. */
export const PITCH_PLACEHOLDER: RadarPitch = {
  pitch: "[Describe Meetwell in 2 or 3 sentences in 'Your Meetwell pitch' at the top]",
  offer: "[What you offer the organiser, e.g. free use for their event]",
  sender: "[Your name]",
};

const NO_THANKS = `If it's not a fit right now, just reply "No thanks" and I won't follow up.`;

const fill = (pitch: RadarPitch, k: keyof RadarPitch) => pitch[k].trim() || PITCH_PLACEHOLDER[k];
const signOff = (pitch: RadarPitch) => `Kind regards,\n${fill(pitch, "sender")}\nmeetwell.me · hello@meetwell.me`;
const greeting = (e: RadarEvent) => `Hello ${e.organizer ? `${e.organizer} team` : "there"},`;
export const subjectOf = (e: RadarEvent) => e.subject || `Partnership idea for ${e.name}`;

export type Email = { subject: string; body: string };

/** The first partner email. */
export function partnerEmail(e: RadarEvent, pitch: RadarPitch): Email {
  const body = `${greeting(e)}

${e.hook || `I came across ${e.name} and love what you are putting together for Lagos.`}

${fill(pitch, "pitch")}

${e.idea || `At ${e.name}, Meetwell could help your guests make more of the people they meet.`}

${(e.offer ?? "").trim() || fill(pitch, "offer")}

Since ${e.name} takes place on ${dateText(e)}, could we have a quick 15-minute call this week to see whether a partnership would work for you? I am happy to fit around your schedule.

${NO_THANKS}

${signOff(pitch)}`;
  return { subject: subjectOf(e), body };
}

/** The one follow-up, 3 days after the first email, sent as a reply in the same thread. */
export function followUpEmail(e: RadarEvent, pitch: RadarPitch): Email {
  const body = `${greeting(e)}

I wanted to check in on my last email and see how Meetwell can help your attendees have a great experience at ${e.name}.

${NO_THANKS}

${signOff(pitch)}`;
  return { subject: `Re: ${subjectOf(e)}`, body };
}

/** True while the email still has a [placeholder] to fill in. */
export const hasPlaceholder = (text: string) => /\[[^\]]+\]/.test(text);

/** One CSV row per event, for Excel. */
export function radarCsv(events: RadarEvent[], today: string) {
  const head = ["Event", "Start date", "End date", "Days away", "Where", "Category", "Organiser", "Venue / platform", "Contact email", "Stage", "First email sent", "Follow-up", "Notes", "Event page"];
  const cell = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    // Quote everything, and stop a cell that starts with = + - @ being read as a formula
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const follow = (e: RadarEvent) => {
    const d = followUpIn(e, today);
    if (d !== null) return d <= 0 ? "Due now" : `In ${d} day${d === 1 ? "" : "s"}`;
    return e.followed_up_on ? `Sent ${e.followed_up_on}` : "";
  };
  const rows = [...events]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((e) =>
      [
        e.name, e.start_date, e.end_date ?? e.start_date, isPast(e, today) ? "Finished" : daysBetween(today, e.start_date),
        e.format === "online" ? "Online" : "In person", e.category, e.organizer, e.venue, e.contact,
        RADAR_STAGES.find((s) => s.value === e.status)?.label, e.status !== "new" ? e.contacted_on : "", follow(e), e.notes, e.link,
      ].map(cell).join(","),
    );
  return [head.map(cell).join(","), ...rows].join("\r\n");
}
