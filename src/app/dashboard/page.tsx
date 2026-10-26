import { ArrowUpRight, Download, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyLinkButton, ShareButton } from "@/components/dashboard/share-actions";
import { PublishButton } from "@/components/dashboard/publish-controls";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { publicProfilePath, publicProfileUrl, qrTargetUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");

  const [{ published, password }, qr] = await Promise.all([searchParams, qrSvg(qrTargetUrl(profile.slug), { margin: 1 })]);
  const isLive = profile.status === "published";
  const url = publicProfileUrl(profile.slug);

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
  );
}
