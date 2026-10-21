import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ExperienceForm } from "@/components/matching/experience-form";
import { MatchingPrefsForm } from "@/components/matching/matching-prefs-form";
import { MentorStatus } from "@/components/matching/mentor-status";
import { SparkAllowance } from "@/components/matching/spark-allowance";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/misc";
import { publicProfilePath } from "@/lib/config";
import { MATCHING_MIN_COMPLETENESS, profileCompleteness } from "@/lib/matching/completeness";
import { fieldLabel, isMentor, MENTOR_MIN_YEARS, SPARK_FREE_PER_MONTH } from "@/lib/matching/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Spark" };

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
  const [{ data: profile }, matches, used, mentorStats] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "status, field, experience_years, looking_for, city, matching_opt_in, avatar_url, professional_title, organization, bio, website_url, website_is_public, contact_methods(is_public), social_links(is_public)",
      )
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.rpc("my_matches"),
    supabase.rpc("my_matches_this_month"),
    supabase.rpc("my_spark_mentor_stats"),
  ]);
  // Years decide the side of Spark: under ${MENTOR_MIN_YEARS} get introductions, ${MENTOR_MIN_YEARS}+ are recommended.
  const needsExperience = !!profile && profile.experience_years === null;
  const mentor = !!profile && isMentor(profile.experience_years);
  const introduced = ((mentorStats.data ?? []) as { this_month: number; total: number }[])[0] ?? { this_month: 0, total: 0 };
  const rows = (matches.data ?? []) as MatchRow[];
  const usedThisMonth = Number(used.data ?? 0);
  const completeness = profile
    ? profileCompleteness({
        avatarUrl: profile.avatar_url,
        title: profile.professional_title,
        organization: profile.organization,
        bio: profile.bio,
        hasPublicContact: (profile.contact_methods ?? []).some((c: { is_public: boolean }) => c.is_public),
        hasPublicLink:
          (profile.social_links ?? []).some((l: { is_public: boolean }) => l.is_public) ||
          (!!profile.website_url && profile.website_is_public),
        field: profile.field,
        experienceYears: profile.experience_years,
        lookingFor: profile.looking_for ?? [],
        city: profile.city,
      })
    : null;

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
          <Sparkles className="size-5 text-accent" aria-hidden /> Spark
        </h1>
        {mentor ? (
          <p className="mt-1 text-ink-2">
            With {profile.experience_years} years of experience, you&apos;re someone others want to learn from. Spark
            introduces you to members earlier in their careers in your field, so they can reach out and say hello.
          </p>
        ) : (
          <p className="mt-1 text-ink-2">
            Spark introduces you to someone a step ahead of you: an experienced person in your field ({MENTOR_MIN_YEARS}+
            years) you can learn from. Up to {SPARK_FREE_PER_MONTH} free introductions a month, at most one a day, by
            email and here.
          </p>
        )}
      </div>

      {profile && !needsExperience && !mentor && <SparkAllowance used={usedThisMonth} />}

      {!profile ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            title="Create your card first"
            description="Spark uses your card, so set it up and publish it to get matches."
            action={<ButtonLink href="/onboarding">Create your card</ButtonLink>}
          />
        </div>
      ) : needsExperience ? (
        <ExperienceForm initial={{ field: profile.field ?? "", experienceYears: "" }} />
      ) : (
        <>
          {profile.status !== "published" && (
            <Alert>
              Your card isn&apos;t published yet, so {mentor ? "Spark can’t recommend you" : "you won’t get matches"}.{" "}
              <Link href="/dashboard/profile" className="underline">Publish your card</Link> to start.
            </Alert>
          )}
          {mentor && (
            <MentorStatus
              fieldName={fieldLabel(profile.field)}
              introduced={introduced}
              checks={[
                { label: "Spark switched on", done: profile.matching_opt_in, where: "below" },
                { label: "Card published", done: profile.status === "published", where: "card" },
                { label: "Profile photo", done: !!profile.avatar_url, where: "card" },
                { label: `Profile at least ${MATCHING_MIN_COMPLETENESS}% complete`, done: !!completeness?.ready, where: "card" },
              ]}
            />
          )}
          {completeness && (
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium text-ink">Your profile is {completeness.percent}% complete</p>
                <p className="text-sm text-ink-3">
                  {MATCHING_MIN_COMPLETENESS}% needed {mentor ? "to be recommended" : "for matches"}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div
                  className={completeness.ready ? "h-full rounded-full bg-accent" : "h-full rounded-full bg-[#c58a2b]"}
                  style={{ width: `${completeness.percent}%` }}
                />
              </div>
              {completeness.missing.length > 0 ? (
                <div className="mt-4 text-sm">
                  <p className="text-ink-2">
                    {completeness.ready
                      ? "You're ready. To stand out even more, add:"
                      : mentor
                        ? "Add these so Spark can recommend you:"
                        : "Add these to start getting matches:"}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {completeness.missing.map((m) => (
                      <li key={m.label} className="flex items-center justify-between gap-3">
                        <span className="text-ink">{m.label}</span>
                        {m.where === "card" ? (
                          <Link href="/dashboard/profile" className="shrink-0 font-medium text-accent hover:underline">
                            Edit card
                          </Link>
                        ) : (
                          <span className="shrink-0 text-ink-3">Below</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-2">Everything&apos;s filled in. Nice work.</p>
              )}
            </section>
          )}
          <MatchingPrefsForm
            mentor={mentor}
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

      {profile && !needsExperience && !mentor && (
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">Your matches</h2>
          <p className="text-sm text-ink-3">{rows.length} in total</p>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState
              title="No matches yet"
              description="Turn on Spark above. When we find someone worth meeting, they'll appear here and we'll email you."
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
      )}
    </div>
  );
}
