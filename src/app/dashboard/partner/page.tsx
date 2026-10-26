import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyPartnerLink } from "@/components/dashboard/copy-partner-link";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Card } from "@/components/ui/misc";
import { getSiteUrl } from "@/lib/config";
import { eventDates } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Partner" };

type Partner = { id: string; slug: string; name: string; active: boolean; max_signups: number; signups: number };
type Person = {
  joined_at: string;
  published: boolean;
  mentor: boolean;
  slug: string | null;
  full_name: string | null;
  avatar_url: string | null;
  professional_title: string | null;
  organization: string | null;
};

type Money = { earned_kobo: number; paid_kobo: number; available_kobo: number; pending_kobo: number };
const NO_MONEY: Money = { earned_kobo: 0, paid_kobo: 0, available_kobo: 0, pending_kobo: 0 };
const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);

const joined = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

type PartnerEvent = { partner_name: string; slug: string; name: string; starts_on: string; active: boolean; speakers: number; conversations?: number };

/**
 * For a partner's team (an event platform such as ThinkUX): their invite link
 * and everyone who joined Meetwell through it. Public card details only.
 */
export default async function PartnerPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_partners");
  const partners = (data ?? []) as Partner[];
  if (partners.length === 0) notFound();

  const [people, money, { data: eventRows }] = await Promise.all([
    Promise.all(
      partners.map(async (p) => ((await supabase.rpc("partner_people", { p_partner: p.id })).data ?? []) as Person[]),
    ),
    Promise.all(
      partners.map(
        async (p) =>
          (((await supabase.rpc("my_partner_money", { p_partner: p.id })).data ?? []) as Money[])[0] ?? NO_MONEY,
      ),
    ),
    supabase.rpc("my_partner_events"),
  ]);
  const allEvents = (eventRows ?? []) as PartnerEvent[];

  return (
    <div className="flex flex-col gap-10">
      {partners.map((partner, i) => {
        const list = people[i];
        const published = list.filter((p) => p.published).length;
        const mentors = list.filter((p) => p.mentor).length;
        return (
          <section key={partner.id} className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{partner.name} on Meetwell</h1>
              <p className="mt-1 text-ink-2">
                Share this link with your speakers. It works as their invite, and everyone who joins through it shows
                up here.
              </p>
            </div>

            <Card className="flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Your invite link</h2>
                {!partner.active && <Badge tone="warning">Paused</Badge>}
              </div>
              <CopyPartnerLink link={`${getSiteUrl()}/join?partner=${partner.slug}`} />
              <p className="text-sm text-ink-3">
                {partner.signups} of {partner.max_signups} invites used.
              </p>
            </Card>

            {allEvents.some((e) => e.partner_name === partner.name) && (
              <Card className="flex flex-col gap-3 p-5 sm:p-6">
                <div>
                  <h2 className="font-semibold">Your event pages</h2>
                  <p className="mt-1 text-sm text-ink-2">
                    Every speaker&apos;s card in one place. Put the QR code on your slides, and speakers&apos; QR codes on
                    their badges.
                  </p>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {allEvents
                    .filter((e) => e.partner_name === partner.name)
                    .map((e) => (
                      <li key={e.slug} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0">
                          <Link href={`/e/${e.slug}`} className="font-medium text-ink hover:underline">{e.name}</Link>
                          <span className="block text-xs text-ink-3">
                            {eventDates(e.starts_on, null)} · {e.speakers} {e.speakers === 1 ? "speaker" : "speakers"}
                            {typeof e.conversations === "number" && <> · {e.conversations} {e.conversations === 1 ? "conversation" : "conversations"} started</>}
                            {!e.active && " · hidden"}
                          </span>
                        </span>
                        <a href={`/e/${e.slug}/qr`} className="text-sm text-accent hover:underline">Download event QR</a>
                      </li>
                    ))}
                </ul>
              </Card>
            )}

            <dl className="grid grid-cols-3 gap-3">
              {[
                { label: "Joined", value: partner.signups },
                { label: "Published a card", value: published },
                { label: "Mentors", value: mentors },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
                  <dt className="text-sm text-ink-2">{s.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>

            <Card className="flex flex-col gap-4 p-5 sm:p-6">
              <div>
                <h2 className="font-semibold">Your earnings</h2>
                <p className="mt-1 text-sm text-ink-2">
                  You earn 10% of what your speakers are paid as mentors on Meetwell, for each speaker&apos;s first 12
                  months, and 10% of every paid message started from one of your event pages, for 12 months after each event. Meetwell pays you by
                  bank transfer.
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  { label: "Earned", value: naira(money[i].earned_kobo) },
                  { label: "Paid to you", value: naira(money[i].paid_kobo) },
                  {
                    label: "Still to be paid",
                    value: naira(money[i].earned_kobo - money[i].paid_kobo),
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-2 p-4">
                    <dt className="text-sm text-ink-2">{s.label}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="p-0">
              <h2 className="border-b border-border px-5 py-4 font-semibold sm:px-6">People who joined</h2>
              {list.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-2 sm:px-6">
                  Nobody yet. Send the link to your speakers to get started.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((p, j) => (
                    <li key={p.slug ?? `setup-${j}`} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      {p.published && p.full_name ? (
                        <>
                          <Avatar name={p.full_name} src={p.avatar_url} className="size-10 text-sm" />
                          <div className="min-w-0 flex-1">
                            <Link href={`/p/${p.slug}`} className="font-medium text-ink hover:underline">
                              {p.full_name}
                            </Link>
                            <p className="truncate text-sm text-ink-2">
                              {[p.professional_title, p.organization].filter(Boolean).join(" · ") || "Meetwell member"}
                            </p>
                          </div>
                          {p.mentor && <Badge tone="accent">Mentor</Badge>}
                        </>
                      ) : (
                        <>
                          <Avatar name="?" className="size-10 text-sm" />
                          <p className="min-w-0 flex-1 text-sm text-ink-2">Setting up their card</p>
                        </>
                      )}
                      <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">{joined(p.joined_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
