import { ArrowUpRight, Check, Circle, Download, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyLinkButton, ShareButton } from "@/components/dashboard/share-actions";
import { PublishButton } from "@/components/dashboard/publish-controls";
import { completion, toFormValues } from "@/components/editor/types";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { publicProfilePath, publicProfileUrl, qrTargetUrl } from "@/lib/config";
import { LineChart } from "@/components/dashboard/line-chart";
import { BarList } from "@/components/dashboard/bar-list";
import { BreakdownBar, type Slice } from "@/components/dashboard/breakdown-bar";
import { dailyCounts, percentChange, rate } from "@/lib/profiles/analytics";
import { getOwnProfile, getOwnProfileStats, getOwnViewTimes } from "@/lib/profiles/queries";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "Dashboard" };

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

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");

  const [{ published, password }, stats, stats60, viewTimes, qr] = await Promise.all([
    searchParams,
    getOwnProfileStats(30),
    getOwnProfileStats(60),
    getOwnViewTimes(60),
    qrSvg(qrTargetUrl(profile.slug), { margin: 1 }),
  ]);
  const isLive = profile.status === "published";
  const { checks, percent } = completion(toFormValues(profile, null));
  const url = publicProfileUrl(profile.slug);

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
    { label: "QR scans", value: stats.viewsBySource.qr, color: "#1f4d3f" },
    { label: "Shared link", value: stats.viewsBySource.link, color: "#4f9474" },
    { label: "Opened directly", value: stats.viewsBySource.direct, color: "#a3d1b8" },
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
      {published && <Alert tone="success">Your card is live. Share your link or QR code to start connecting.</Alert>}
      {password && <Alert tone="success">Your password has been updated.</Alert>}

      <Card className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={profile.fullName} src={profile.avatarUrl} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{profile.fullName}</h1>
            {isLive ? <Badge tone="success">● Live</Badge> : <Badge tone="warning">{profile.status === "draft" ? "Draft" : "Offline"}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-ink-2">{[profile.title, profile.organization].filter(Boolean).join(" · ") || "Add a title to help people place you"}</p>
          <p className="mt-1 truncate font-mono text-sm text-ink-3">{url.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/dashboard/profile" variant="secondary" icon={<Pencil className="size-4" />}>Edit</ButtonLink>
          <PublishButton published={isLive} />
        </div>
      </Card>

      {!isLive && (
        <Alert>
          {profile.status === "draft"
            ? "Your card is a draft. Publish it so your link and QR code work."
            : "Your card is offline. Visitors see that it's unavailable until you publish it again."}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Engagement</h2>
              <span className="text-sm text-ink-3">Last {stats.days} days</span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
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

            <div className="mt-5">
              <LineChart title="Views per day" points={daily} compare={dailyBefore} labelEvery={7} />
              {best.value > 0 && (
                <p className="mt-2 text-xs text-ink-3">
                  Best day: {best.label}, with {best.value} {best.value === 1 ? "view" : "views"}.
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <BreakdownBar title="Where views come from" slices={sources} unit="views" change={percentChange(stats.views, before("views"))} empty="No views yet. Share your link or QR code." />
              <BarList title="What visitors do" rows={actions} empty="No taps yet. They'll show here." />
            </div>
            <p className="mt-4 text-xs text-ink-3">Anonymous totals only. We don&apos;t record who visitors are, and your own visits aren&apos;t counted. Changes compare with the 30 days before.</p>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Profile strength</h2>
              <span className="text-sm font-medium tabular-nums text-ink-2">{percent}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
              <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm">
                  {c.done ? <Check className="size-4 text-success" aria-hidden /> : <Circle className="size-4 text-ink-3" aria-hidden />}
                  <span className={c.done ? "text-ink-2" : "text-ink"}>{c.label}</span>
                  <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                </li>
              ))}
            </ul>
            {percent < 100 && (
              <Link href="/dashboard/profile" className="mt-5 inline-block text-sm font-medium text-accent hover:underline">
                Complete your card →
              </Link>
            )}
          </Card>
        </div>

        <Card className="flex flex-col items-center p-5 sm:p-6">
          <h2 className="self-start font-semibold">Your QR code</h2>
          <div className="mt-4 w-full max-w-[14rem] rounded-2xl border border-border p-3 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="QR code for your profile" />
          <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
            <CopyLinkButton url={url} />
            <ShareButton url={url} title={`${profile.fullName} on Meetwell`} />
          </div>
          <div className="mt-3 flex w-full flex-col gap-2">
            <Link href="/dashboard/qr" className={buttonClass({ variant: "ghost", size: "sm" })}>Download QR code</Link>
            {isLive && (
              <a href={publicProfilePath(profile.slug)} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "ghost", size: "sm" })}>
                View public card <ArrowUpRight className="size-4" aria-hidden />
              </a>
            )}
            <a href="/dashboard/vcard" download className={buttonClass({ variant: "ghost", size: "sm" })}>
              <Download className="size-4" aria-hidden /> Download my vCard
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
