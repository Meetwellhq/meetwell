import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeatureForm } from "@/components/admin/feature-form";
import { EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Feature a member" };

// Sending is paced to stay under Resend's rate limit, so allow time for a batch.
export const maxDuration = 60;

export default async function FeaturePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_members");
  // Non-admins get a plain 404; the database refuses them anyway.
  if (error) notFound();

  const members = ((data ?? []) as { slug: string | null; full_name: string | null; card_status: string | null }[])
    .filter((m) => m.card_status === "published" && m.slug)
    .map((m) => ({ slug: m.slug!, fullName: m.full_name || m.slug! }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Feature a member</h1>
        <p className="mt-1 text-ink-2">
          Introduce a member to people on the waiting list, with their QR code and a link to their card. Each person
          gets each feature once, and every email has an unsubscribe link.
        </p>
      </div>
      {members.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState title="No published cards yet" description="Members appear here once they publish their card." />
        </div>
      ) : (
        <FeatureForm members={members} />
      )}
    </div>
  );
}
