import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { AdminOverview, type Metrics } from "@/components/admin/admin-overview";
import { SparkLaunch, type SparkProgress } from "@/components/admin/spark-launch";
import { getUsdRate } from "@/lib/fx";
import { SPARK_LAUNCH_USERS } from "@/lib/spark";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const [{ data, error }, rate, spark] = await Promise.all([
    supabase.rpc("admin_metrics"),
    getUsdRate(),
    supabase.rpc("admin_spark_progress"),
  ]);
  const progress = ((spark.data ?? []) as SparkProgress[])[0];
  if (error || !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle title="Overview">How Meetwell is doing, at a glance.</PageTitle>
        <NotReady what="The overview" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {progress && <SparkLaunch progress={progress} goal={SPARK_LAUNCH_USERS} />}
      <AdminOverview m={data as Metrics} rate={rate} />
    </div>
  );
}
