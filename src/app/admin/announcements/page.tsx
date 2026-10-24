import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { date, NotReady, PageTitle } from "@/components/admin/admin-ui";
import { AnnounceButton } from "@/components/admin/announce-button";
import { ButtonLink } from "@/components/ui/button";
import type { AnnouncementKind } from "@/lib/admin/actions";
import { TEMPLATES } from "@/lib/admin/campaigns";
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

type EmailResult = {
  template: string;
  sent_on: string;
  people: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  acted: number;
};

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "0%");

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const [history, ...results] = await Promise.all([
    supabase.rpc("admin_email_results"),
    ...ANNOUNCEMENTS.map((a) => supabase.rpc("admin_announcement_status", { p_kind: a.kind })),
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
            <h2 className="text-lg font-semibold text-ink">Sent with New email</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              &ldquo;Did it&rdquo; means they have now done what the email asked. Opens are a rough guide: some email apps
              count every email as opened.
            </p>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {sends.map((s) => {
              const t = TEMPLATES.find((x) => x.id === s.template);
              return (
                <li key={`${s.template}-${s.sent_on}`} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{t?.label ?? s.template}</p>
                    <p className="text-sm text-ink-2">
                      {date(`${s.sent_on}T12:00:00Z`)} · sent to {s.people} {s.people === 1 ? "person" : "people"}
                      {s.bounced > 0 && <span className="text-danger"> · {s.bounced} bounced</span>}
                    </p>
                  </div>
                  <dl className="grid grid-cols-4 gap-4 text-center sm:gap-6">
                    {[
                      { label: "Delivered", value: s.delivered },
                      { label: "Opened", value: s.opened },
                      { label: "Clicked", value: s.clicked },
                      { label: `Did it (${t?.did ?? "done"})`, value: s.acted, strong: true },
                    ].map((m) => (
                      <div key={m.label} className="min-w-16">
                        <dd className={`text-lg font-semibold tabular-nums ${m.strong ? "text-accent" : "text-ink"}`}>
                          {pct(m.value, s.people)}
                        </dd>
                        <dt className="text-xs text-ink-3">{m.label}</dt>
                        <dd className="text-xs tabular-nums text-ink-3">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="-mb-3 text-lg font-semibold text-ink">One-off announcements</h2>
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
