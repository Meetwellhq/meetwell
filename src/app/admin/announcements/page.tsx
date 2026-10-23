import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { AnnounceButton } from "@/components/admin/announce-button";
import type { AnnouncementKind } from "@/lib/admin/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcements · Admin" };

// Announcement emails are paced, so give the server action time for a batch.
export const maxDuration = 60;

// Newest first.
const ANNOUNCEMENTS: { kind: AnnouncementKind; title: string; label: string }[] = [
  { kind: "mentoring", title: "Mentoring is open on Meetwell", label: "Mentoring" },
  { kind: "spark_beta", title: "Come and try Spark, our new beta feature", label: "Spark" },
];

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const results = await Promise.all(
    ANNOUNCEMENTS.map((a) => supabase.rpc("admin_announcement_status", { p_kind: a.kind })),
  );
  const failed = results.some((r) => r.error);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Announcements">
        One-off emails from you to every user with a confirmed account. Each person gets each one once.
      </PageTitle>
      {failed ? (
        <NotReady what="Announcements" />
      ) : (
        <div className="flex flex-col gap-3">
          {ANNOUNCEMENTS.map((a, i) => {
            const status = ((results[i].data ?? []) as { sent: number; remaining: number }[])[0] ?? { sent: 0, remaining: 0 };
            return (
              <div
                key={a.kind}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{a.title}</p>
                  <p className="text-sm text-ink-2">
                    Sent to {status.sent} · {status.remaining} to go
                  </p>
                </div>
                <AnnounceButton kind={a.kind} label={a.label} remaining={status.remaining} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
