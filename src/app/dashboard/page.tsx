import { ArrowRight, ArrowUpRight, Download, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyLinkButton, LinkField, ShareButton } from "@/components/dashboard/share-actions";
import { PublishButton } from "@/components/dashboard/publish-controls";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { publicProfilePath, publicProfileUrl, qrTargetUrl } from "@/lib/config";
import { rate } from "@/lib/profiles/analytics";
import { getOwnProfile, getOwnProfileStats } from "@/lib/profiles/queries";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "Dashboard" };

const tips = [
  "Point your phone camera at the code to test it. It opens your public card in the browser.",
  "Add it to your slides, badge, email signature, laptop sticker or printed business card.",
  "Print it at least 2 cm (0.8 in) wide and keep the white border around it.",
  "Edits to your card show up instantly. The code never changes, so you never need to reprint it.",
];

/** The member's card, QR code and link in one place (the QR code page now lives here). */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");

  const [{ published, password }, qr, stats] = await Promise.all([searchParams, qrSvg(qrTargetUrl(profile.slug)), getOwnProfileStats(30)]);
  const isLive = profile.status === "published";
  const url = publicProfileUrl(profile.slug);
  // A quick look at the last 30 days; the Analytics page has the rest.
  const insights = [
    { label: "Profile views", value: stats.views },
    { label: "QR scans", value: stats.qrScans },
    { label: "Contacts saved", value: stats.saves },
    { label: "Save rate", value: `${rate(stats.saves, stats.views)}%` },
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

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="flex flex-col items-center p-5 sm:p-6 lg:row-span-2">
          <h2 className="self-start font-semibold">Your QR code</h2>
          <div className="mt-4 w-full max-w-[16rem] rounded-2xl border border-border bg-surface p-3 [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`QR code linking to ${url}`} dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <a href="/dashboard/qr/download?format=png" download className={buttonClass()}>
              <Download className="size-4" aria-hidden /> PNG
            </a>
            <a href="/dashboard/qr/download?format=svg" download className={buttonClass({ variant: "secondary" })}>
              <Download className="size-4" aria-hidden /> SVG
            </a>
          </div>
          <p className="mt-2 text-xs text-ink-3">PNG for sharing and slides · SVG for print</p>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">Your link</h2>
          <p className="mt-1 text-sm text-ink-2">Your QR code opens this address, so it always shows your latest card and privacy settings.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <LinkField url={url} />
            <div className="flex gap-2">
              <CopyLinkButton url={url} variant="primary" />
              <ShareButton url={url} title={`${profile.fullName} on Meetwell`} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
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
        <Card className="p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Last 30 days</h2>
            <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              All analytics <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            {insights.map((s) => (
              <div key={s.label} className="rounded-xl bg-surface-2 p-4">
                <dt className="truncate text-sm text-ink-2">{s.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h2 className="font-semibold">How to use your QR code</h2>
          <ul className="mt-3 flex flex-col gap-2.5 text-[15px] text-ink-2">
            {tips.map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
