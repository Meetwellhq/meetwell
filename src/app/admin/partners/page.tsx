import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { AddPartner, PartnerList, type PartnerRow } from "@/components/admin/partners-admin";
import { getSiteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Partners · Admin" };

export default async function AdminPartnersPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_partners");
  const rows = (data ?? []) as PartnerRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Partners">
        Event platforms and communities that invite their speakers to Meetwell. Each partner gets its own link, which
        works as an invite. Everyone who joins through it is counted for that partner, and their team can see who joined.
      </PageTitle>
      <AddPartner />
      {error ? <NotReady what="Partners" /> : <PartnerList rows={rows} site={getSiteUrl()} />}
    </div>
  );
}
