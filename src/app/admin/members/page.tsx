import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { date, isActive, NotReady, PageTitle, ReminderBadges, Stats, toMembers } from "@/components/admin/admin-ui";
import { Badge, EmptyState } from "@/components/ui/misc";
import { publicProfilePath } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Members · Admin" };

const CARD_BADGE = {
  published: { tone: "success", label: "Published" },
  draft: { tone: "neutral", label: "Draft" },
  unpublished: { tone: "warning", label: "Unpublished" },
} as const;

export default async function AdminMembersPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_members");
  const people = toMembers(data);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Members">Everyone with an account: is their card set up, and is it being used?</PageTitle>

      {error ? (
        <NotReady what="Members" />
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
    </div>
  );
}
