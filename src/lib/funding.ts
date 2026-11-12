/**
 * Funding radar: grants, accelerators, competitions and fellowships that suit
 * Meetwell, found by a weekly search so there's time to apply. Pure helpers
 * (stages, tabs, deadlines), unit-tested; the page is /admin/funding.
 */

import { daysBetween, shortDate } from "./radar";

export const FUNDING_STAGES = [
  { value: "new", label: "New" },
  { value: "preparing", label: "Preparing" },
  { value: "applied", label: "Applied" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "won", label: "Won" },
  { value: "rejected", label: "Not this time" },
  { value: "skipped", label: "Skipped" },
] as const;
export type FundingStatus = (typeof FUNDING_STAGES)[number]["value"];

export const FUNDING_KINDS = [
  { value: "grant", label: "Grant" },
  { value: "accelerator", label: "Accelerator" },
  { value: "competition", label: "Competition" },
  { value: "fellowship", label: "Fellowship" },
  { value: "investor", label: "Investor" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
] as const;
export type FundingKind = (typeof FUNDING_KINDS)[number]["value"];

export const FUNDING_REGIONS = ["Nigeria", "Africa", "Global"] as const;
export type FundingRegion = (typeof FUNDING_REGIONS)[number];

export type Funding = {
  id: string;
  name: string;
  funder: string | null;
  kind: FundingKind;
  amount: string | null;
  equity_free: boolean | null;
  deadline: string | null;
  region: FundingRegion;
  link: string | null;
  eligibility: string | null;
  fit: string | null;
  prepare: string | null;
  status: FundingStatus;
  notes: string | null;
  source: "manual" | "weekly-search";
  found_on: string;
  applied_on: string | null;
  updated_at: string;
};

export const kindLabel = (k: FundingKind) => FUNDING_KINDS.find((x) => x.value === k)?.label ?? "Other";
export const stageLabel = (s: FundingStatus) => FUNDING_STAGES.find((x) => x.value === s)?.label ?? s;

/** Days in which a deadline counts as closing soon. */
export const CLOSING_SOON_DAYS = 14;

const OPEN: FundingStatus[] = ["new", "preparing"];
const SENT: FundingStatus[] = ["applied", "shortlisted"];

export const isClosed = (f: Funding, today: string) => f.deadline !== null && daysBetween(today, f.deadline) < 0;

export type FundingTab = "soon" | "review" | "preparing" | "applied" | "done" | "closed" | "all";
export const FUNDING_TABS: { value: FundingTab; label: string }[] = [
  { value: "soon", label: "Closing soon" },
  { value: "review", label: "To review" },
  { value: "preparing", label: "Preparing" },
  { value: "applied", label: "Applied" },
  { value: "done", label: "Done" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

/** Not applied yet, and the deadline is within two weeks. */
export const closingSoon = (f: Funding, today: string) =>
  OPEN.includes(f.status) && f.deadline !== null && !isClosed(f, today) && daysBetween(today, f.deadline) <= CLOSING_SOON_DAYS;

/** Where each opportunity sits. "Closing soon" overlaps the others, like the partner radar's follow-ups. */
export function bucket(f: Funding, today: string): Exclude<FundingTab, "soon" | "all"> {
  if (SENT.includes(f.status)) return "applied";
  if (!OPEN.includes(f.status)) return "done";
  if (isClosed(f, today)) return "closed";
  return f.status === "preparing" ? "preparing" : "review";
}

export const inTab = (f: Funding, tab: FundingTab, today: string) =>
  tab === "all" || (tab === "soon" ? closingSoon(f, today) : bucket(f, today) === tab);

/** The deadline in words, and how urgent it is. */
export function deadlineText(f: Pick<Funding, "deadline">, today: string): { tone: "past" | "late" | "soon" | "fine" | "rolling"; text: string } {
  if (!f.deadline) return { tone: "rolling", text: "Rolling or no date yet" };
  const d = daysBetween(today, f.deadline);
  const on = shortDate(f.deadline);
  if (d < 0) return { tone: "past", text: `Closed ${on}` };
  if (d === 0) return { tone: "late", text: "Closes today" };
  if (d <= 7) return { tone: "late", text: `Closes in ${d} day${d === 1 ? "" : "s"} · ${on}` };
  if (d <= CLOSING_SOON_DAYS) return { tone: "soon", text: `Closes in ${d} days · ${on}` };
  return { tone: "fine", text: `Closes ${on} · ${d} days` };
}

/** Sort: nearest deadline first, rolling ones after, then by name. */
export const byDeadline = (a: Funding, b: Funding) =>
  (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.name.localeCompare(b.name);
