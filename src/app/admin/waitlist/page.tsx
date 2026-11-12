import type { Metadata } from "next";
import { NotReady, PageTitle, Stats, type WaitlistRow } from "@/components/admin/admin-ui";
import { WaitlistTable } from "@/components/admin/waitlist-table";
import { EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Waiting list · Admin" };

export default async function AdminWaitlistPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_waitlist");
  // Newest activity first: a fresh invite or a new joiner goes to the top.
  const latest = (r: WaitlistRow) => Math.max(Date.parse(r.joined_at), r.invited_at ? Date.parse(r.invited_at) : 0);
  const rows = ((data ?? []) as WaitlistRow[]).sort((a, b) => latest(b) - latest(a));
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
            <WaitlistTable rows={rows} />
          )}
        </>
      )}
    </div>
  );
}
