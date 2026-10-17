import { Download } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CopyLinkButton, LinkField, ShareButton } from "@/components/dashboard/share-actions";
import { buttonClass } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/misc";
import { publicProfileUrl, qrTargetUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "QR code" };

const tips = [
  "Point your phone camera at the code to test it — it opens your public card in the browser.",
  "Add it to your slides, badge, email signature, laptop sticker or printed business card.",
  "Print it at least 2 cm (0.8 in) wide and keep the white border around it.",
  "Edits to your card show up instantly. The code never changes, so you never need to reprint it.",
];

export default async function QrPage() {
  const profile = await getOwnProfile();
  if (!profile) redirect("/onboarding");
  const url = publicProfileUrl(profile.slug);
  const svg = await qrSvg(qrTargetUrl(profile.slug));

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Card className="flex flex-col items-center p-6">
        <div className="w-full rounded-2xl border border-border bg-white p-4 [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`QR code linking to ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
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

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your QR code</h1>
          <p className="mt-1 text-ink-2">It links to your permanent profile address — not your contact details — so it always reflects your latest card and privacy settings.</p>
        </div>
        {profile.status !== "published" && (
          <Alert>Your card isn&apos;t published, so scanning this code shows it as unavailable until you publish.</Alert>
        )}
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">Your link</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <LinkField url={url} />
            <div className="flex gap-2">
              <CopyLinkButton url={url} variant="primary" />
              <ShareButton url={url} title={`${profile.fullName} on Meetwell`} />
            </div>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">How to use it</h2>
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
