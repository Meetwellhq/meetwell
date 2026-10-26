import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { AnnounceButton } from "@/components/admin/announce-button";
import { EmailResultCard, HowToRead, type EmailResult } from "@/components/admin/email-results";
import { ButtonLink } from "@/components/ui/button";
import type { AnnouncementKind } from "@/lib/admin/actions";
import { isSparkOn } from "@/lib/spark";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcements · Admin" };

// Announcement emails are paced, so give the server action time for a batch.
export const maxDuration = 60;

// Newest first.
const ANNOUNCEMENTS: { kind: AnnouncementKind; title: string; label: string; who?: string }[] = [
  { kind: "publish_card", title: "Your Meetwell card is one tap from going live", label: "Publish card", who: "Only users whose card is still a draft" },
  { kind: "mentoring", title: "Mentoring is open on Meetwell", label: "Mentoring" },
  { kind: "spark_beta", title: "Come and try Spark, our new beta feature", label: "Spark" },
];

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  // Spark is paused until launch, so its announcement isn't offered.
  const shown = (await isSparkOn()) ? ANNOUNCEMENTS : ANNOUNCEMENTS.filter((a) => a.kind !== "spark_beta");
  const [history, ...results] = await Promise.all([
    supabase.rpc("admin_email_results"),
    ...shown.map((a) => supabase.rpc("admin_announcement_status", { p_kind: a.kind })),
  ]);
  const sends = (history.data ?? []) as EmailResult[];
  const failed = results.some((r) => r.error);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle title="Announcements">
          Emails from you to users with a confirmed account. Choose who gets each one with New email.
        </PageTitle>
        <ButtonLink href="/admin/announcements/new" className="shrink-0">
          <Plus className="size-4" aria-hidden />
          New email
        </ButtonLink>
      </div>

      {sends.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Results of emails sent with New email</h2>
            <p className="mt-0.5 text-sm text-ink-2">Newest first. Each one shows how far people got, from receiving it to doing what it asked.</p>
          </div>
          <HowToRead />
          <ul className="flex flex-col gap-3">
            {sends.map((s) => (
              <EmailResultCard key={`${s.template}-${s.sent_on}`} result={s} />
            ))}
          </ul>
        </section>
      )}

      <h2 className="-mb-3 text-lg font-semibold text-ink">One-off announcements</h2>
      {failed ? (
        <NotReady what="Announcements" />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((a, i) => {
            const status = ((results[i].data ?? []) as { sent: number; remaining: number }[])[0] ?? { sent: 0, remaining: 0 };
            return (
              <div
                key={a.kind}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{a.title}</p>
                  <p className="text-sm text-ink-2">
                    {a.who && <>{a.who} · </>}Sent to {status.sent} · {status.remaining} to go
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
