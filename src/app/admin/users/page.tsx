import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { date, isActive, NotReady, PageTitle, ReminderBadges, Stats, toMembers } from "@/components/admin/admin-ui";
import { UsersToolbar } from "@/components/admin/users-toolbar";
import { Badge, EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { publicProfilePath } from "@/lib/config";
import { isMentor, MENTOR_MIN_YEARS } from "@/lib/matching/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users · Admin" };

const CARD_BADGE = {
  published: { tone: "success", label: "Published" },
  draft: { tone: "neutral", label: "Draft" },
  unpublished: { tone: "warning", label: "Unpublished" },
} as const;

/** Mentors have 4+ years and are recommended to others; mentees (under 4) get introductions. */
type Role = "mentor" | "mentee" | "unset";
const roleOf = (years: number | null): Role => (years == null ? "unset" : isMentor(years) ? "mentor" : "mentee");

const ROLES = ["all", "mentor", "mentee", "unset"] as const;
const CARDS = ["all", "published", "draft", "unpublished", "none"] as const;
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "active", label: "Last seen" },
  { value: "views", label: "Most views" },
] as const;
const PER_PAGE = 10;

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

/** "1 : 3.5" mentees for every mentor. */
function ratio(mentors: number, mentees: number) {
  if (mentors === 0) return mentees === 0 ? "None yet" : "No mentors yet";
  return `1 : ${Number((mentees / mentors).toFixed(1))}`;
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const [{ data, error }, params] = await Promise.all([
    (await createClient()).rpc("admin_list_members"),
    searchParams,
  ]);
  const people = toMembers(data);

  // Search, filters and sort come from the address, so each view has its own link.
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const role = pick(ROLES, params.role, "all");
  const card = pick(CARDS, params.card, "all");
  const sort = pick(SORTS.map((o) => o.value), params.sort, "newest");
  const needle = q.toLowerCase();
  const matching = people
    .filter((m) => !needle || m.email.toLowerCase().includes(needle) || (m.full_name ?? "").toLowerCase().includes(needle))
    .filter((m) => role === "all" || roleOf(m.experience_years) === role)
    .filter((m) => card === "all" || (card === "none" ? m.card_status === null : m.card_status === card))
    .sort((a, b) =>
      sort === "oldest" ? time(a.joined_at) - time(b.joined_at)
      : sort === "active" ? time(b.last_sign_in_at) - time(a.last_sign_in_at)
      : sort === "views" ? b.views - a.views
      : time(b.joined_at) - time(a.joined_at),
    );
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const page = Math.min(Math.max(Number.parseInt(String(params.page ?? "1"), 10) || 1, 1), pages);
  const shown = matching.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageHref = (n: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (role !== "all") qs.set("role", role);
    if (card !== "all") qs.set("card", card);
    if (sort !== "newest") qs.set("sort", sort);
    if (n > 1) qs.set("page", String(n));
    const str = qs.toString();
    return str ? `/admin/users?${str}` : "/admin/users";
  };

  const mentors = people.filter((m) => roleOf(m.experience_years) === "mentor");
  const mentees = people.filter((m) => roleOf(m.experience_years) === "mentee").length;
  const unset = people.length - mentors.length - mentees;
  const approved = mentors.filter((m) => m.mentor_status === "approved").length;
  const known = mentors.length + mentees;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Users">Everyone with an account: is their card set up, and is it being used?</PageTitle>

      {error ? (
        <NotReady what="Users" />
      ) : (
        <>
          <Stats
            columns={3}
            items={[
              { label: "Total users", value: people.length },
              { label: "Active users (last 30 days)", value: people.filter((m) => isActive(m.last_sign_in_at)).length },
              { label: "Published cards", value: people.filter((m) => m.card_status === "published").length },
              { label: "Cards with a photo", value: people.filter((m) => m.has_photo).length },
              { label: "QR scans (all cards)", value: people.reduce((n, m) => n + m.qr_scans, 0) },
              { label: "Contacts saved (all cards)", value: people.reduce((n, m) => n + m.contacts_saved, 0) },
            ]}
          />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Mentors and mentees</h2>
            <Stats
              items={[
                {
                  label: `Mentors (${MENTOR_MIN_YEARS}+ years)`,
                  value: mentors.length,
                  note: `${approved} approved for paid mentoring`,
                },
                { label: `Mentees (under ${MENTOR_MIN_YEARS} years)`, value: mentees },
                { label: "Mentor to mentee ratio", value: ratio(mentors.length, mentees), note: "mentees for every mentor" },
                { label: "Years not set yet", value: unset, note: "No card, or skipped the question" },
              ]}
            />
            {known > 0 && (
              <div>
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="bg-accent" style={{ width: `${(mentors.length / known) * 100}%` }} />
                  <span className="bg-mentee" style={{ width: `${(mentees / known) * 100}%` }} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-ink-2">
                  <span><span className="mr-1.5 inline-block size-2 rounded-full bg-accent" />Mentors {Math.round((mentors.length / known) * 100)}%</span>
                  <span><span className="mr-1.5 inline-block size-2 rounded-full bg-mentee" />Mentees {Math.round((mentees / known) * 100)}%</span>
                </p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold text-ink">All users</h2>
              <p className="text-sm text-ink-2">
                {matching.length === people.length ? `${people.length} users` : `${matching.length} of ${people.length} users`}
              </p>
            </div>
            <UsersToolbar
              q={q}
              role={role}
              card={card}
              sort={sort}
              roles={[
                { value: "all", label: `Everyone (${people.length})` },
                { value: "mentor", label: `Mentors (${mentors.length})` },
                { value: "mentee", label: `Mentees (${mentees})` },
                { value: "unset", label: `Years not set (${unset})` },
              ]}
              cards={[
                { value: "all", label: "Any card" },
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
                { value: "unpublished", label: "Unpublished" },
                { value: "none", label: "No card" },
              ]}
              sorts={[...SORTS]}
            />

          {shown.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface">
              {people.length === 0 ? (
                <EmptyState title="No accounts yet" description="People appear here once they create an account." />
              ) : (
                <EmptyState title="No users found" description="Try another search or clear the filters." />
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {shown.map((m) => {
                const badge = m.card_status ? CARD_BADGE[m.card_status] : null;
                const role = roleOf(m.experience_years);
                return (
                  <li key={m.email} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{m.full_name || "No card yet"}</p>
                      <p className="truncate text-sm text-ink-2">{m.email}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        Joined {date(m.joined_at)}
                        {m.last_sign_in_at && <> · Last seen {date(m.last_sign_in_at)}</>}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {role === "unset" ? (
                          <Badge>Years not set</Badge>
                        ) : (
                          <Badge tone={role === "mentor" ? "accent" : "mentee"}>
                            {role === "mentor" ? "Mentor" : "Mentee"} · {m.experience_years} {m.experience_years === 1 ? "year" : "years"}
                          </Badge>
                        )}
                        {m.mentor_status === "approved" && <Badge tone="success">Approved mentor</Badge>}
                        {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : <Badge>No card</Badge>}
                        {m.card_status && <Badge>{m.has_photo ? "Has photo" : "No photo"}</Badge>}
                        {!m.confirmed && <Badge tone="warning">Email not confirmed</Badge>}
                        <ReminderBadges reminders={m.reminders} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-5 sm:gap-6">
                      <dl className="flex gap-5 text-center">
                        {[
                          { label: "Views", value: m.views },
                          { label: "QR scans", value: m.qr_scans },
                          { label: "Saves", value: m.contacts_saved },
                        ].map((s) => (
                          <div key={s.label}>
                            <dd className="text-lg font-semibold tabular-nums text-ink">{s.value}</dd>
                            <dt className="text-xs text-ink-3">{s.label}</dt>
                          </div>
                        ))}
                      </dl>
                      {m.card_status === "published" && m.slug && (
                        <a
                          href={publicProfilePath(m.slug)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                        >
                          View card
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {pages > 1 && (
            <nav className="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Pages">
              <p className="text-sm text-ink-2">
                Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, matching.length)} of {matching.length}
              </p>
              <div className="flex items-center gap-1">
                <PageLink href={pageHref(page - 1)} disabled={page === 1} label="Previous page">
                  <ChevronLeft className="size-4" aria-hidden />
                </PageLink>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                  .map((n, i, list) => (
                    <span key={n} className="flex items-center gap-1">
                      {i > 0 && n - list[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
                      <PageLink href={pageHref(n)} current={n === page} label={`Page ${n}`}>
                        {n}
                      </PageLink>
                    </span>
                  ))}
                <PageLink href={pageHref(page + 1)} disabled={page === pages} label="Next page">
                  <ChevronRight className="size-4" aria-hidden />
                </PageLink>
              </div>
            </nav>
          )}
          </section>
        </>
      )}
    </div>
  );
}

function PageLink({
  href,
  label,
  current = false,
  disabled = false,
  children,
}: {
  href: string;
  label: string;
  current?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls = "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm tabular-nums transition-colors";
  if (disabled) {
    return <span aria-label={label} aria-disabled className={cn(cls, "border-border text-ink-3 opacity-50")}>{children}</span>;
  }
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(
        cls,
        current ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-ink-2 hover:border-border-strong hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
