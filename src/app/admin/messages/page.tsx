import type { Metadata } from "next";
import { date, NotReady, PageTitle, Stats } from "@/components/admin/admin-ui";
import { OpenConversationForm, PausedToggle, ReportActions } from "@/components/admin/messaging-admin";
import { Badge, EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages · Admin" };

type ConversationRow = {
  id: number;
  member_email: string;
  mentor_email: string;
  messages: number;
  access_until: string;
  last_message_at: string | null;
};

type ReportRow = {
  id: number;
  reason: string;
  note: string | null;
  status: "open" | "dismissed" | "actioned";
  created_at: string;
  reporter_email: string;
  reported_email: string;
  reported_paused: boolean;
  context: { reported: boolean; by_reported: boolean; body: string; created_at: string }[] | null;
};

const REASON = {
  harassment: "Harassment or bullying",
  spam: "Spam or selling",
  scam: "Scam or asking for money",
  inappropriate: "Inappropriate or offensive",
  other: "Something else",
} as Record<string, string>;

export default async function AdminMessagesPage() {
  const supabase = await createClient();
  const [conversations, reports] = await Promise.all([
    supabase.rpc("admin_list_conversations"),
    supabase.rpc("admin_list_reports"),
  ]);
  if (conversations.error) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle title="Messages">Conversations between users and mentors.</PageTitle>
        <NotReady what="Messages" />
      </div>
    );
  }
  const convs = (conversations.data ?? []) as ConversationRow[];
  const reps = (reports.data ?? []) as ReportRow[];
  const open = reps.filter((r) => r.status === "open");
  const active = convs.filter((c) => new Date(c.access_until) > new Date());

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Messages">
        Conversations between users and mentors. You see who talks to whom and how much, never what they say,
        except for messages someone reports.
      </PageTitle>

      <Stats
        columns={3}
        items={[
          { label: "Active conversations", value: active.length },
          { label: "Messages sent", value: convs.reduce((n, c) => n + Number(c.messages), 0) },
          { label: "Open reports", value: open.length },
        ]}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Reports</h2>
        {reps.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState title="No reports" description="Reported messages will show up here, with a few messages around them." />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reps.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{REASON[r.reason] ?? r.reason}</p>
                    <p className="text-sm text-ink-2">
                      {r.reporter_email} reported {r.reported_email} · {date(r.created_at)}
                    </p>
                    {r.note && <p className="mt-1 text-sm text-ink">&ldquo;{r.note}&rdquo;</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {r.status === "open" ? <Badge tone="warning">Open</Badge> : <Badge>{r.status === "dismissed" ? "Dismissed" : "Paused them"}</Badge>}
                    <PausedToggle email={r.reported_email} paused={r.reported_paused} />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3">
                  {(r.context ?? []).map((m, i) => (
                    <p
                      key={i}
                      className={`whitespace-pre-wrap break-words text-sm ${m.reported ? "rounded-md bg-white p-2 font-medium text-ink ring-1 ring-danger/40" : "text-ink-2"}`}
                    >
                      <span className="text-xs text-ink-3">{m.by_reported ? r.reported_email : r.reporter_email}: </span>
                      {m.body}
                    </p>
                  ))}
                </div>
                <div className="mt-3">
                  <ReportActions id={r.id} open={r.status === "open"} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <OpenConversationForm />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Conversations</h2>
        {convs.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState title="No conversations yet" description="Open a test conversation above to try messaging." />
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {convs.map((c) => {
              const live = new Date(c.access_until) > new Date();
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {c.member_email} → {c.mentor_email}
                    </p>
                    <p className="text-xs text-ink-3">
                      {c.messages} messages
                      {c.last_message_at && <> · last {date(c.last_message_at)}</>} · {live ? "open until" : "ended"} {date(c.access_until)}
                    </p>
                  </div>
                  <Badge tone={live ? "success" : "neutral"}>{live ? "Open" : "Ended"}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
