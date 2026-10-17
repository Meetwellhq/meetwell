import type { Metadata } from "next";
import Link from "next/link";
import { DangerZone, PublishButton } from "@/components/dashboard/publish-controls";
import { Card } from "@/components/ui/misc";
import { getOwnProfile } from "@/lib/profiles/queries";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getOwnProfile()]);
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

      <Card className="border-[#fecdca] p-5 sm:p-6">
        <h2 className="mb-4 font-semibold text-danger">Danger zone</h2>
        <DangerZone />
      </Card>
    </div>
  );
}
