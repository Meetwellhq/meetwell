import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { naira, PageTitle, Stats } from "@/components/admin/admin-ui";
import { type UsdRate, usdFromKobo } from "@/lib/fx";
import { BarChart } from "./bar-chart";

export type Metrics = {
  members: number;
  members_this_month: number;
  members_last_month: number;
  confirmed: number;
  active_30d: number;
  active_7d: number;
  cards_published: number;
  waitlist: number;
  waitlist_waiting: number;
  waitlist_this_month: number;
  spark_on: number;
  mentors: number;
  seekers: number;
  matches_this_month: number;
  qr_scans_30d: number;
  saves_30d: number;
  revenue_total_kobo: number;
  revenue_this_month_kobo: number;
  revenue_last_month_kobo: number;
  revenue_30d_kobo: number;
  paying_members: number;
  paying_30d: number;
  credits_sold: number;
  credits_used: number;
  signups_by_week: { start: string; count: number }[];
  revenue_by_month: { start: string; kobo: number }[];
};

const lagos = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString("en-GB", { ...opts, timeZone: "Africa/Lagos" });
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%");

/** "+3 vs last month", "same as last month", "−1 vs last month". */
function versus(now: number, before: number, format: (n: number) => string = String) {
  if (now === before) return "Same as last month";
  const diff = now - before;
  return `${diff > 0 ? "+" : "−"}${format(Math.abs(diff))} vs last month`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** The admin overview: revenue, growth and Spark numbers, with two charts. */
export function AdminOverview({ m, rate }: { m: Metrics; rate: UsdRate | null }) {
  const n = (k: keyof Metrics) => Number(m[k] ?? 0);
  // Revenue in dollars at the daily rate; naira if the rate is unavailable.
  const money = (kobo: number) => (rate ? usdFromKobo(kobo, rate) : naira(kobo));

  // Credits are one-off purchases, so MRR here is a run rate: the last 30 days of sales.
  const mrr = n("revenue_30d_kobo");
  const arr = mrr * 12;
  const arppu = n("paying_members") > 0 ? n("revenue_total_kobo") / n("paying_members") : 0;

  const sections = [
    { href: "/admin/waitlist", title: "Waiting list", text: `${n("waitlist_waiting")} waiting for an invite` },
    { href: "/admin/users", title: "Users", text: `${n("members")} users, ${n("cards_published")} with a live card` },
    { href: "/admin/announcements", title: "Announcements", text: "One-off emails to every user" },
    { href: "/admin/payments", title: "Payments", text: `${n("paying_members")} paying users` },
  ];

  return (
    <div className="flex flex-col gap-10">
      <PageTitle title="Overview">How Meetwell is doing, at a glance. Months are in Lagos time.</PageTitle>

      <Section title="Revenue">
        <Stats
          items={[
            {
              label: "Revenue this month",
              value: money(n("revenue_this_month_kobo")),
              note: versus(n("revenue_this_month_kobo"), n("revenue_last_month_kobo"), money),
            },
            { label: "MRR", value: money(mrr), note: "Last 30 days of sales" },
            { label: "ARR", value: money(arr), note: "MRR × 12" },
            { label: "Total revenue", value: money(n("revenue_total_kobo")), note: `${naira(n("revenue_total_kobo"))} since launch` },
            { label: "Paying users", value: n("paying_members"), note: `${n("paying_30d")} in the last 30 days` },
            { label: "Revenue per paying user", value: money(arppu), note: "Since launch" },
            { label: "Credits sold", value: n("credits_sold"), note: `${n("credits_used")} used` },
            { label: "Paying share", value: pct(n("paying_members"), n("members")), note: "Of all users" },
          ]}
        />
        <BarChart
          title="Revenue by month"
          points={(m.revenue_by_month ?? []).map((p) => ({ label: lagos(p.start, { month: "short" }), value: Number(p.kobo) }))}
          format={money}
        />
        <p className="text-xs text-ink-3">
          Revenue is Meetwell&apos;s share: all credit sales and 20% of mentor subscriptions. Users pay in naira.{" "}
          {rate ? (
            <>
              Dollar amounts use $1 = {naira(rate.ngnPerUsd * 100)}, updated daily (
              <a href="https://www.exchangerate-api.com" className="underline">
                rates by Exchange Rate API
              </a>
              ).
            </>
          ) : (
            "The dollar rate couldn't be loaded, so amounts are shown in naira."
          )}{" "}
          Spark credits are one-off purchases, so MRR and ARR are run rates based on the last 30 days. They become
          true recurring revenue once paid subscriptions start.
        </p>
      </Section>

      <Section title="Growth">
        <Stats
          items={[
            { label: "Users", value: n("members"), note: "With an account" },
            { label: "Joined this month", value: n("members_this_month"), note: versus(n("members_this_month"), n("members_last_month")) },
            { label: "Waiting list", value: n("waitlist"), note: `${n("waitlist_waiting")} waiting · ${n("waitlist_this_month")} new this month` },
            { label: "Cards published", value: n("cards_published"), note: `${pct(n("cards_published"), n("members"))} of users` },
            { label: "Active in 7 days", value: n("active_7d"), note: pct(n("active_7d"), n("members")) },
            { label: "Active in 30 days", value: n("active_30d"), note: pct(n("active_30d"), n("members")) },
            { label: "Email confirmed", value: n("confirmed"), note: pct(n("confirmed"), n("members")) },
            { label: "QR scans", value: n("qr_scans_30d"), note: `${n("saves_30d")} contacts saved · last 30 days` },
          ]}
        />
        <BarChart
          title="New users per week"
          points={(m.signups_by_week ?? []).map((p) => ({ label: lagos(p.start, { day: "numeric", month: "short" }), value: Number(p.count) }))}
          format={(v) => String(v)}
          labelEvery={3}
        />
      </Section>

      <Section title="Spark">
        <Stats
          items={[
            { label: "Spark switched on", value: n("spark_on"), note: pct(n("spark_on"), n("members")) + " of users" },
            { label: "Under 4 years", value: n("seekers"), note: "Get introductions" },
            { label: "4+ years (mentors)", value: n("mentors"), note: "Recommended to others" },
            { label: "Introductions this month", value: n("matches_this_month") },
          ]}
        />
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
          >
            <div>
              <p className="font-medium text-ink">{s.title}</p>
              <p className="mt-0.5 text-sm text-ink-2">{s.text}</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
