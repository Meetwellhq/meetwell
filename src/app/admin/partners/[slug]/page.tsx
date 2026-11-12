import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { date, naira, NotReady, PageTitle, Stats } from "@/components/admin/admin-ui";
import { AddEvent, EventCard, type AdminEvent } from "@/components/admin/events-admin";
import { PartnerSummary, RecordPayout, type PartnerMoney, type PartnerRow } from "@/components/admin/partners-admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/misc";
import { getSiteUrl } from "@/lib/config";
import { eventDates } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { PaginatedList } from "@/components/ui/paginated-list";

export const metadata: Metadata = { title: "Partner · Admin" };

type Person = {
  joined_at: string;
  email: string;
  published: boolean;
  mentor: boolean;
  slug: string | null;
  full_name: string | null;
  avatar_url: string | null;
  professional_title: string | null;
  organization: string | null;
};

type LedgerRow = { created_at: string; kind: "earning" | "refund" | "payout"; amount_kobo: number; mentor_name: string | null; note: string | null };

/** One partner: its link, numbers and team, its earnings, then everyone who joined through it. */
export default async function AdminPartnerPage({ params }: PageProps<"/admin/partners/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_partners");
  if (error) return <NotReady what="Partners" />;
  const partner = ((data ?? []) as PartnerRow[]).find((p) => p.slug === slug);
  if (!partner) notFound();

  const [{ data: rows }, { data: moneyRows }, { data: ledgerRows }, { data: eventRows, error: eventsError }] = await Promise.all([
    supabase.rpc("admin_partner_people", { p_partner: partner.id }),
    supabase.rpc("admin_partner_money", { p_partner: partner.id }),
    supabase.rpc("admin_partner_ledger", { p_partner: partner.id }),
    supabase.rpc("admin_partner_events", { p_partner_slug: partner.slug }),
  ]);
  const events = (eventRows ?? []) as AdminEvent[];
  const people = (rows ?? []) as Person[];
  const money = ((moneyRows ?? []) as PartnerMoney[])[0] ?? { earned_kobo: 0, paid_kobo: 0, available_kobo: 0, pending_kobo: 0 };
  const ledger = (ledgerRows ?? []) as LedgerRow[];
  const mentors = people.filter((p) => p.mentor);
  const others = people.filter((p) => !p.mentor);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/partners" className="flex items-center gap-1.5 self-start text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All partners
      </Link>
      <PageTitle title={partner.name}>
        Added {date(partner.created_at)}.{!partner.active && " The link is paused, so nobody new can join through it."}
      </PageTitle>

      <PartnerSummary partner={partner} site={getSiteUrl()} />

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div>
          <h2 className="font-medium text-ink">Their earnings</h2>
          <p className="text-sm text-ink-2">
            10% of what their mentors are paid, for each mentor&apos;s first 12 months, plus 10% of every paid message
            started from one of their event pages, for 12 months after each event. It comes out of Meetwell&apos;s 20%.
          </p>
        </div>
        <Stats
          items={[
            { label: "Earned", value: naira(money.earned_kobo), note: "After refunds" },
            { label: "Paid to them", value: naira(money.paid_kobo) },
            { label: "Ready to pay", value: naira(money.available_kobo) },
            { label: "In the 7-day window", value: naira(money.pending_kobo), note: "Ready after 7 days" },
          ]}
        />
        <RecordPayout partnerId={partner.id} availableKobo={money.available_kobo} />
        {ledger.length > 0 && (
          <PaginatedList className="divide-y divide-border border-t border-border">
            {ledger.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">
                    {l.kind === "earning"
                      ? `10% of a payment to ${l.mentor_name ?? "a mentor"}`
                      : l.kind === "refund"
                        ? `Refund of a payment to ${l.mentor_name ?? "a mentor"}`
                        : `Paid to ${partner.name}${l.note ? `: ${l.note}` : ""}`}
                  </span>
                  <span className="block text-xs text-ink-3">{date(l.created_at)}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${l.amount_kobo < 0 ? "text-ink-2" : "font-medium text-ink"}`}>
                  {l.amount_kobo < 0 ? "−" : "+"}
                  {naira(Math.abs(l.amount_kobo))}
                </span>
              </li>
            ))}
          </PaginatedList>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div>
          <h2 className="font-medium text-ink">Event pages</h2>
          <p className="text-sm text-ink-2">
            One page per event with every speaker&apos;s card and QR codes for badges and slides. When someone pays to
            message a speaker from the event page, {partner.name} gets 10%, even if the speaker was already on Meetwell, for 12
            months after the event.
          </p>
        </div>
        {eventsError ? (
          <NotReady what="Event pages" />
        ) : (
          <>
            {events.length > 0 && (
              <ul className="flex flex-col gap-3">
                {events.map((e) => (
                  <EventCard key={e.slug} event={e} site={getSiteUrl()} dates={eventDates(e.starts_on, e.ends_on)} revenue={naira(e.revenue_kobo)} />
                ))}
              </ul>
            )}
            <details className="rounded-lg border border-dashed border-border p-3" open={events.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-ink">Add an event</summary>
              <div className="mt-3">
                <AddEvent partnerSlug={partner.slug} />
              </div>
            </details>
          </>
        )}
      </section>

      <PeopleSection title="Mentors they invited" people={mentors} empty="None of their people are mentors yet." />
      <PeopleSection title="Everyone else who joined" people={others} empty="Nobody else yet." />
    </div>
  );
}

function PeopleSection({ title, people, empty }: { title: string; people: Person[]; empty: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 font-medium text-ink">
        {title} <span className="font-normal text-ink-3">({people.length})</span>
      </h2>
      {people.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-2">{empty}</p>
      ) : (
        <PaginatedList className="divide-y divide-border">
          {people.map((p) => (
            <li key={p.email} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.full_name ?? p.email} src={p.avatar_url} className="size-10 text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {p.published && p.slug ? (
                    <Link href={`/p/${p.slug}`} target="_blank" className="font-medium text-ink hover:underline">
                      {p.full_name}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{p.full_name ?? "No card yet"}</span>
                  )}
                  {!p.published && <Badge>{p.full_name ? "Draft card" : "Setting up"}</Badge>}
                </div>
                <p className="truncate text-sm text-ink-2">
                  {[p.professional_title, p.organization].filter(Boolean).join(" · ") || p.email}
                </p>
              </div>
              <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">Joined {date(p.joined_at)}</span>
            </li>
          ))}
        </PaginatedList>
      )}
    </section>
  );
}
