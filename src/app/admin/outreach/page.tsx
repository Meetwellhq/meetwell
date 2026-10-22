import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { OutreachList, type OutreachRow } from "@/components/admin/outreach-list";
import { getSiteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Outreach · Admin" };

export default async function AdminOutreachPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_outreach");
  const rows = (data ?? []) as OutreachRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Outreach">
        People you&apos;ve found on X. Add them here, copy their message, and send it yourself as a DM or reply. Each person
        gets their own invite link, so you can see who signed up. Around 10 to 20 a day keeps your X account safe.
      </PageTitle>

      {error ? <NotReady what="The outreach list" /> : <OutreachList rows={rows} site={getSiteUrl()} />}
    </div>
  );
}
