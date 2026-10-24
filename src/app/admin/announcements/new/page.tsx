import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { CampaignForm, CampaignSendButton, CampaignTestButton } from "@/components/admin/campaign-form";
import { audienceArgs, audienceParams, parseAudience, ROLES, TEMPLATES } from "@/lib/admin/campaigns";
import { previewCampaignEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New email · Admin" };

// Sending is paced, so give the server action time for a batch.
export const maxDuration = 60;

export default async function NewEmailPage({ searchParams }: PageProps<"/admin/announcements/new">) {
  const audience = parseAudience(await searchParams);
  const args = audienceArgs(audience);
  const supabase = await createClient();
  const [people, ...roleCounts] = await Promise.all([
    supabase.rpc("admin_email_audience", { ...args, p_limit: 5000 }),
    ...ROLES.map((role) => supabase.rpc("admin_email_audience_count", { ...args, p_role: role })),
  ]);
  const template = TEMPLATES.find((t) => t.id === audience.template)!;

  if (people.error) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle title="New email">Choose an email and who gets it.</PageTitle>
        <NotReady what="New email" />
      </div>
    );
  }

  const list = (people.data ?? []) as { email: string; full_name: string | null }[];
  const counts = Object.fromEntries(ROLES.map((r, i) => [r, (roleCounts[i].data as number | null) ?? 0])) as Record<(typeof ROLES)[number], number>;
  const email = previewCampaignEmail(audience.template, list[0]?.full_name ?? null);
  const shown = list.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/announcements" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          Announcements
        </Link>
        <div className="mt-3">
          <PageTitle title="New email">Choose a ready-made email and who gets it. Check the preview, send yourself a test, then send.</PageTitle>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-lg font-semibold text-ink">Who gets it</h2>
            <CampaignForm audience={audience} counts={counts} />
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-ink-2">This email will go to</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">
              {list.length} {list.length === 1 ? "person" : "people"}
            </p>
            {list.length > 0 ? (
              <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                {shown.map((p) => (
                  <li key={p.email} className="flex flex-col px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <span className="truncate text-sm font-medium text-ink">{p.full_name || "No name yet"}</span>
                    <span className="truncate text-sm text-ink-3">{p.email}</span>
                  </li>
                ))}
                {list.length > shown.length && (
                  <li className="px-3 py-2 text-sm text-ink-3">and {list.length - shown.length} more</li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-2">
                Nobody matches. Try fewer filters, or allow people who already had it to get it again.
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-start gap-3">
              <CampaignSendButton
                key={new URLSearchParams(audienceParams(audience)).toString()}
                audience={audience}
                count={list.length}
                label={template.label}
              />
              <CampaignTestButton key={audience.template} template={audience.template} />
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Sends in batches of up to 40. If more are left, click again. Everyone who gets it is logged, so nobody gets
              it twice unless you allow it above.
            </p>
          </section>
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs uppercase tracking-wider text-ink-3">Preview</p>
            <p className="mt-1 font-medium text-ink">{email.subject}</p>
          </div>
          <iframe title="Email preview" srcDoc={email.html} className="h-[720px] w-full bg-white" sandbox="" />
        </section>
      </div>
    </div>
  );
}
