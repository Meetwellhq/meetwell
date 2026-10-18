import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteButton } from "@/components/admin/invite-button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invites" };

type Row = {
  email: string;
  full_name: string | null;
  joined_at: string;
  invited_at: string | null;
  signed_up: boolean;
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default async function InvitesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_waitlist");
  // Non-admins get a plain 404; the database refuses them anyway.
  if (error) notFound();
  const rows = (data ?? []) as Row[];

  const invited = rows.filter((r) => r.invited_at).length;
  const signedUp = rows.filter((r) => r.signed_up).length;
  const stats = [
    { label: "On the waiting list", value: rows.length },
    { label: "Invited", value: invited },
    { label: "Signed up", value: signedUp },
    { label: "Waiting for an invite", value: rows.length - invited },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Invites</h1>
        <p className="mt-1 text-ink-2">
          Invite people from the waiting list. Each person gets a personal, single-use code by email, from you.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <dt className="text-sm text-ink-2">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

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
    </div>
  );
}
