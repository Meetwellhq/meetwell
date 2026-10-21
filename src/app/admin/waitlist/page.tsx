import type { Metadata } from "next";
import { date, NotReady, PageTitle, ReminderBadges, Stats, type WaitlistRow } from "@/components/admin/admin-ui";
import { InviteButton } from "@/components/admin/invite-button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Waiting list · Admin" };

export default async function AdminWaitlistPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_waitlist");
  const rows = (data ?? []) as WaitlistRow[];
  const invited = rows.filter((r) => r.invited_at).length;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Waiting list">
        Invite people from the waiting list. Each person gets a personal, single-use code by email, from you.
      </PageTitle>

      {error ? (
        <NotReady what="The waiting list" />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
