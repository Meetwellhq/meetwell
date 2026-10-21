import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteButton } from "@/components/admin/invite-button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { publicProfilePath } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invites" };

type Reminder = { kind: keyof typeof REMINDER_LABEL; sent_at: string };

type WaitlistRow = {
  email: string;
  full_name: string | null;
  joined_at: string;
  invited_at: string | null;
  signed_up: boolean;
  reminders?: Reminder[];
};

type MemberRow = {
  email: string;
  joined_at: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  full_name: string | null;
  slug: string | null;
  card_status: "draft" | "published" | "unpublished" | null;
  has_photo: boolean;
  views: number;
  qr_scans: number;
  contacts_saved: number;
  reminders?: Reminder[];
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

/** Automatic one-time reminders (see the daily job in /api/cron/reminders). */
const REMINDER_LABEL = {
  invite_unused: "Invite reminder sent",
  email_unconfirmed: "Confirmation re-sent",
  card_draft: "Finish-card reminder sent",
  no_scans: "QR tip sent",
  profile_incomplete: "Profile reminder sent",
} as const;

function ReminderBadges({ reminders }: { reminders?: Reminder[] }) {
  return (reminders ?? []).map((r) => (
    <Badge key={r.kind} tone="accent">
      {REMINDER_LABEL[r.kind] ?? "Reminder sent"} {date(r.sent_at)}
    </Badge>
  ));
}

const CARD_BADGE = {
  published: { tone: "success", label: "Published" },
  draft: { tone: "neutral", label: "Draft" },
  unpublished: { tone: "warning", label: "Unpublished" },
} as const;

/** "Active" = logged in during the last 30 days. */
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
function isActive(lastSignIn: string | null) {
  return !!lastSignIn && Date.now() - new Date(lastSignIn).getTime() < ACTIVE_WINDOW_MS;
}

function Stats({ items, columns = 4 }: { items: { label: string; value: number }[]; columns?: 3 | 4 }) {
  return (
    <dl className={`grid grid-cols-2 gap-3 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
      {items.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-sm text-ink-2">{s.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function InvitesPage() {
  const supabase = await createClient();
  const [waitlist, members] = await Promise.all([
    supabase.rpc("admin_list_waitlist"),
    supabase.rpc("admin_list_members"),
  ]);
  // Non-admins get a plain 404; the database refuses them anyway.
  if (waitlist.error) notFound();
  const rows = (waitlist.data ?? []) as WaitlistRow[];
  const people = ((members.data ?? []) as MemberRow[]).map((m) => ({
    ...m,
    views: Number(m.views),
    qr_scans: Number(m.qr_scans),
    contacts_saved: Number(m.contacts_saved),
  }));

  const invited = rows.filter((r) => r.invited_at).length;

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Invites</h1>
          <p className="mt-1 text-ink-2">
            Invite people from the waiting list. Each person gets a personal, single-use code by email, from you.
          </p>
        </div>

        <Stats
          items={[
            { label: "On the waiting list", value: rows.length },
            { label: "Invited", value: invited },
            { label: "Signed up", value: rows.filter((r) => r.signed_up).length },
            { label: "Waiting for an invite", value: rows.length - invited },
          ]}
        />

        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState title="No one on the waiting list yet" description="People who join early access will show up here." />
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {rows.map((r) => (
              <li key={r.email} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{r.full_name || "No name"}</p>
                  <p className="truncate text-sm text-ink-2">{r.email}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    Joined {date(r.joined_at)}
                    {r.invited_at && <> · Invited {date(r.invited_at)}</>}
                  </p>
                  {!!r.reminders?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ReminderBadges reminders={r.reminders} />
                    </div>
                  )}
                </div>
                {r.signed_up ? (
                  <Badge tone="success">Signed up</Badge>
                ) : (
                  <InviteButton email={r.email} fullName={r.full_name} invited={!!r.invited_at} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Members</h2>
          <p className="mt-1 text-ink-2">Everyone with an account: is their card set up, and is it being used?</p>
        </div>

        {members.error ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-ink-2">
            Members can&apos;t be loaded yet. Run the members SQL in Supabase first.
          </p>
        ) : (
          <>
            <Stats
              columns={3}
              items={[
                { label: "Total users", value: people.length },
                { label: "Active users (last 30 days)", value: people.filter((m) => isActive(m.last_sign_in_at)).length },
                { label: "Published cards", value: people.filter((m) => m.card_status === "published").length },
                { label: "Cards with a photo", value: people.filter((m) => m.has_photo).length },
                { label: "QR scans (all cards)", value: people.reduce((n, m) => n + m.qr_scans, 0) },
                { label: "Contacts saved (all cards)", value: people.reduce((n, m) => n + m.contacts_saved, 0) },
              ]}
            />

            {people.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface">
                <EmptyState title="No accounts yet" description="People appear here once they create an account." />
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {people.map((m) => {
                  const badge = m.card_status ? CARD_BADGE[m.card_status] : null;
                  return (
                    <li key={m.email} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{m.full_name || "No card yet"}</p>
                        <p className="truncate text-sm text-ink-2">{m.email}</p>
                        <p className="mt-1 text-xs text-ink-3">
                          Joined {date(m.joined_at)}
                          {m.last_sign_in_at && <> · Last seen {date(m.last_sign_in_at)}</>}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : <Badge>No card</Badge>}
                          {m.card_status && <Badge>{m.has_photo ? "Has photo" : "No photo"}</Badge>}
                          {!m.confirmed && <Badge tone="warning">Email not confirmed</Badge>}
                          <ReminderBadges reminders={m.reminders} />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-5 sm:gap-6">
                        <dl className="flex gap-5 text-center">
                          {[
                            { label: "Views", value: m.views },
                            { label: "QR scans", value: m.qr_scans },
                            { label: "Saves", value: m.contacts_saved },
                          ].map((s) => (
                            <div key={s.label}>
                              <dd className="text-lg font-semibold tabular-nums text-ink">{s.value}</dd>
                              <dt className="text-xs text-ink-3">{s.label}</dt>
                            </div>
                          ))}
                        </dl>
                        {m.card_status === "published" && m.slug && (
                          <a
                            href={publicProfilePath(m.slug)}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                          >
                            View card
                            <ArrowUpRight className="size-3.5" aria-hidden />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
