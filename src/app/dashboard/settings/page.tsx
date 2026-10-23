import type { Metadata } from "next";
import Link from "next/link";
import { PaymentHistory, type PaymentHistoryRow } from "@/components/dashboard/payment-history";
import { DangerZone, PublishButton } from "@/components/dashboard/publish-controls";
import { Card } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { InstallApp } from "@/components/pwa/install-app";
import { getOwnProfile } from "@/lib/profiles/queries";
import { MessageEmailsSwitch } from "@/components/messaging/message-emails-switch";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [user, profile, emails, payments] = await Promise.all([
    getCurrentUser(),
    getOwnProfile(),
    supabase.rpc("my_message_emails"),
    supabase.rpc("my_payments"),
  ]);
  const isLive = profile?.status === "published";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-4 grid gap-1 text-sm">
          <dt className="text-ink-3">Email</dt>
          <dd className="text-ink">{user?.email}</dd>
        </dl>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Change password
        </Link>
      </Card>

      <Card className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Message emails</h2>
          <p className="mt-1 text-sm text-ink-2">
            Get an email when someone sends you their first message in a conversation. We don&apos;t email you about every message.
          </p>
        </div>
        <MessageEmailsSwitch initial={emails.data !== false} />
      </Card>

      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="mt-1 text-sm text-ink-2">Choose light or dark, or match your phone or computer.</p>
        </div>
        <ThemeToggle />
      </Card>

      <Card className="p-5 sm:p-6">
        <InstallApp variant="row" />
      </Card>

      <Card id="payments" className="scroll-mt-28 p-5 sm:p-6">
        <h2 className="font-semibold">Payment history</h2>
        <p className="mt-1 text-sm text-ink-2">
          Everything you&apos;ve paid for on Meetwell. Payments are made through Paystack, so we never see your card.
          Questions about a payment? Write to us with the reference.
        </p>
        <PaymentHistory rows={(payments.data ?? []) as PaymentHistoryRow[]} />
      </Card>

      {profile && (
        <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="font-semibold">Card visibility</h2>
            <p className="mt-1 text-sm text-ink-2">
              {isLive ? "Your card is public. Anyone with the link or QR code can view it." : "Your card is not public right now."}
            </p>
          </div>
          <PublishButton published={isLive} />
        </Card>
      )}

      <Card className="border-danger-line p-5 sm:p-6">
        <h2 className="mb-4 font-semibold text-danger">Danger zone</h2>
        <DangerZone />
      </Card>
    </div>
  );
}
