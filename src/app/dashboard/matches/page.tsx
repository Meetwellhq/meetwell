import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MatchingPrefsForm } from "@/components/matching/matching-prefs-form";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/misc";
import { publicProfilePath } from "@/lib/config";
import { FREE_MATCHES_PER_MONTH } from "@/lib/matching/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Matches" };

type MatchRow = {
  id: number;
  created_at: string;
  reason: string;
  slug: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  avatar_url: string | null;
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export default async function MatchesPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: profile }, matches, used] = await Promise.all([
    supabase
      .from("profiles")
      .select("status, field, experience_years, looking_for, city, matching_opt_in")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.rpc("my_matches"),
    supabase.rpc("my_matches_this_month"),
  ]);
  const rows = (matches.data ?? []) as MatchRow[];
  const usedThisMonth = Number(used.data ?? 0);

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
          <Sparkles className="size-5 text-accent" aria-hidden /> AI Network Matching
        </h1>
        <p className="mt-1 text-ink-2">
          We look at your field, experience and what you&apos;re looking for, and recommend people worth meeting. Up to{" "}
          {FREE_MATCHES_PER_MONTH} matches a month, by email and here.
        </p>
      </div>

      {!profile ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            title="Create your card first"
            description="Matching uses your card, so set it up and publish it to get matches."
            action={<ButtonLink href="/onboarding">Create your card</ButtonLink>}
          />
        </div>
      ) : (
        <>
          {profile.status !== "published" && (
            <Alert>
              Your card isn&apos;t published yet, so you won&apos;t get matches.{" "}
              <Link href="/dashboard/profile" className="underline">Publish your card</Link> to start.
            </Alert>
          )}
          <MatchingPrefsForm
            initial={{
              optIn: profile.matching_opt_in,
              field: profile.field,
              experienceYears: profile.experience_years,
              lookingFor: profile.looking_for ?? [],
              city: profile.city,
            }}
          />
        </>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">Your matches</h2>
          <p className="text-sm text-ink-3">
            {usedThisMonth} of {FREE_MATCHES_PER_MONTH} this month
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState
              title="No matches yet"
              description="Turn on matching above. When we find someone worth meeting, they'll appear here and we'll email you."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((m) => (
              <li key={m.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={m.full_name} src={m.avatar_url} className="size-12 shrink-0 text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium text-ink">{m.full_name}</p>
                      <p className="shrink-0 text-xs text-ink-3">{date(m.created_at)}</p>
                    </div>
                    {(m.title || m.organization) && (
                      <p className="truncate text-sm text-ink-2">{[m.title, m.organization].filter(Boolean).join(" · ")}</p>
                    )}
                    <p className="mt-2 text-[15px] leading-relaxed text-ink">{m.reason}</p>
                    <a
                      href={publicProfilePath(m.slug)}
                      target="_blank"
                      rel="noopener"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                    >
                      View card
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
