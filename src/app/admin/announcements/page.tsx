import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { AnnounceButton } from "@/components/admin/announce-button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcements · Admin" };

// Announcement emails are paced, so give the server action time for a batch.
export const maxDuration = 60;

export default async function AdminAnnouncementsPage() {
  const { data, error } = await (await createClient()).rpc("admin_announcement_status", { p_kind: "spark_beta" });
  const spark = ((data ?? []) as { sent: number; remaining: number }[])[0] ?? { sent: 0, remaining: 0 };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Announcements">
        One-off emails from you to every user with a confirmed account. Each person gets each one once.
      </PageTitle>
      {error ? (
        <NotReady what="Announcements" />
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3.5">
          <div className="min-w-0">
            <p className="font-medium text-ink">Come and try Spark, our new beta feature</p>
            <p className="text-sm text-ink-2">
              Sent to {spark.sent} · {spark.remaining} to go
            </p>
          </div>
          <AnnounceButton remaining={spark.remaining} />
        </div>
      )}
    </div>
  );
}
