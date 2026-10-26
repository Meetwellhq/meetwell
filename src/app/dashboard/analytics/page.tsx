import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarList } from "@/components/dashboard/bar-list";
import { BreakdownBar, type Slice } from "@/components/dashboard/breakdown-bar";
import { LineChart } from "@/components/dashboard/line-chart";
import { dailyCounts, percentChange, rate } from "@/lib/profiles/analytics";
import { getOwnProfile, getOwnProfileStats, getOwnViewTimes } from "@/lib/profiles/queries";

export const metadata: Metadata = { title: "Analytics" };

/** "▲ 12% vs last 30 days", or a quiet dash when there's nothing to compare with. */
function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-ink-3">No earlier data</span>;
  if (value === 0) return <span className="text-xs text-ink-3">Same as before</span>;
  const up = value > 0;
  return (
    <span className={up ? "text-xs font-medium text-success" : "text-xs font-medium text-danger"}>
      {up ? "▲" : "▼"} {Math.abs(value)}% <span className="font-normal text-ink-3">vs last 30 days</span>
    </span>
  );
}

/** How people find and use the member's card over the last 30 days. Anonymous totals only. */
export default async function AnalyticsPage() {
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");

  const [stats, stats60, viewTimes] = await Promise.all([getOwnProfileStats(30), getOwnProfileStats(60), getOwnViewTimes(60)]);

  // The 30 days before this period: the last 60 days minus the last 30.
  const before = (key: "views" | "qrScans" | "saves" | "contactClicks" | "messagesCopied") => stats60[key] - stats[key];
  const statCards = [
    { label: "Profile views", value: stats.views, change: percentChange(stats.views, before("views")) },
    { label: "From QR scans", value: stats.qrScans, change: percentChange(stats.qrScans, before("qrScans")) },
    { label: "Contacts saved", value: stats.saves, change: percentChange(stats.saves, before("saves")) },
    { label: "Contact & link taps", value: stats.contactClicks, change: percentChange(stats.contactClicks, before("contactClicks")) },
    { label: "Messages copied", value: stats.messagesCopied, change: percentChange(stats.messagesCopied, before("messagesCopied")) },
    { label: "Save rate", value: `${rate(stats.saves, stats.views)}%`, hint: "of views saved your contact" },
  ];
  const daily = dailyCounts(viewTimes, 30);
  // The 30 days before, lined up day by day for the dashed comparison line.
  const dailyBefore = dailyCounts(viewTimes, 60).slice(0, 30).map((p) => p.value);
  const best = daily.reduce((a, b) => (b.value > a.value ? b : a), daily[0]);
  const t = stats.byType;
  // Three tones of the brand green; the legend names each.
  const sources: Slice[] = [
    { label: "QR scans", value: stats.viewsBySource.qr, color: "var(--chart-1)" },
    { label: "Shared link", value: stats.viewsBySource.link, color: "var(--chart-2)" },
    { label: "Opened directly", value: stats.viewsBySource.direct, color: "var(--chart-3)" },
  ];
  const actions = [
    { label: "Saved contact", value: t.save_contact },
    { label: "Email", value: t.email_click },
    { label: "Phone", value: t.phone_click },
    { label: "Website", value: t.website_click },
    { label: "Social links", value: t.social_click },
    { label: "Copied message", value: t.copy_message },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-ink-2">How people find and use your card, over the last {stats.days} days.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-2 p-4">
            <dt className="text-sm text-ink-2">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
            {"hint" in s ? (
              <dd className="mt-1 text-xs text-ink-3">{s.hint}</dd>
            ) : (
              <dd className="mt-1">
                <Change value={s.change} />
              </dd>
            )}
          </div>
        ))}
      </dl>

      <div>
        <LineChart title="Views per day" points={daily} compare={dailyBefore} labelEvery={7} />
        {best.value > 0 && (
          <p className="mt-2 text-xs text-ink-3">
            Best day: {best.label}, with {best.value} {best.value === 1 ? "view" : "views"}.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownBar title="Where views come from" slices={sources} unit="views" change={percentChange(stats.views, before("views"))} empty="No views yet. Share your link or QR code." />
        <BarList title="What visitors do" rows={actions} empty="No taps yet. They'll show here." />
      </div>

      <p className="text-xs text-ink-3">
        Anonymous totals only. We don&apos;t record who visitors are, and your own visits aren&apos;t counted. Changes
        compare with the 30 days before.
      </p>
    </div>
  );
}
