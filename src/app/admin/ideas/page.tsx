import type { Metadata } from "next";
import { NotReady, PageTitle, Stats } from "@/components/admin/admin-ui";
import { IdeasList, type IdeaRow } from "@/components/admin/ideas-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ideas · Admin" };

/** Ideas, problems and other notes members sent from their menu. Each is also emailed to support. */
export default async function AdminIdeasPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_ideas");
  const rows = (data ?? []) as IdeaRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Ideas">
        What members sent from Ideas in their menu. Each one was also emailed to support, so you can reply from there.
      </PageTitle>
      {error ? (
        <NotReady what="Ideas" />
      ) : (
        <>
          <Stats
            items={[
              { label: "New", value: rows.filter((r) => !r.done_at).length },
              { label: "Ideas", value: rows.filter((r) => r.kind === "idea").length },
              { label: "Problems", value: rows.filter((r) => r.kind === "problem").length },
              { label: "Done", value: rows.filter((r) => r.done_at).length },
            ]}
          />
          <IdeasList rows={rows} />
        </>
      )}
    </div>
  );
}
