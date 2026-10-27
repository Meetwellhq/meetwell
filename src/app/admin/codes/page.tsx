import type { Metadata } from "next";
import { NotReady, PageTitle, Stats } from "@/components/admin/admin-ui";
import { CreateSharedCode, SharedCodeList, type SharedCode } from "@/components/admin/shared-codes";
import { Card } from "@/components/ui/misc";
import { getSiteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shared codes · Admin" };

/**
 * One access code many people can use, for events like DevFest: anyone can
 * join with it (no experience rule), up to a limit and until its last day.
 */
export default async function AdminSharedCodesPage() {
  const { data, error } = await (await createClient()).rpc("admin_shared_codes");
  const codes = (data ?? []) as SharedCode[];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Shared codes">
        One code for a whole event. Anyone can join Meetwell with it until it&apos;s used up or its last day ends. Put
        its QR code on slides and posters.
      </PageTitle>
      {error ? (
        <NotReady what="Shared codes" />
      ) : (
        <>
          <Stats
            items={[
              { label: "Codes on", value: codes.filter((c) => c.active).length },
              { label: "Joined", value: codes.reduce((n, c) => n + c.joined, 0) },
              { label: "Published a card", value: codes.reduce((n, c) => n + c.published, 0) },
            ]}
          />
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="font-semibold">Make a shared code</h2>
            <CreateSharedCode />
          </Card>
          <SharedCodeList codes={codes} site={getSiteUrl()} />
        </>
      )}
    </div>
  );
}
