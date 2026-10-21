import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { AdminOverview, type Metrics } from "@/components/admin/admin-overview";
import { getUsdRate } from "@/lib/fx";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [{ data, error }, rate] = await Promise.all([(await createClient()).rpc("admin_metrics"), getUsdRate()]);
  if (error || !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle title="Overview">How Meetwell is doing, at a glance.</PageTitle>
        <NotReady what="The overview" />
      </div>
    );
  }
  return <AdminOverview m={data as Metrics} rate={rate} />;
}
