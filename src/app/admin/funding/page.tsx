import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { FundingBoard } from "@/components/admin/funding-board";
import type { Funding } from "@/lib/funding";
import { lagosToday } from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Funding radar · Admin" };

export default async function AdminFundingPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_funding");

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Funding radar">
        Grants, accelerators, competitions and fellowships that suit Meetwell, with their deadlines. The weekly search
        adds new finds every Monday, and you get an email a week before a deadline you haven&apos;t applied to.
      </PageTitle>

      {error ? <NotReady what="The funding radar" /> : <FundingBoard items={(data ?? []) as Funding[]} today={lagosToday()} />}
    </div>
  );
}
