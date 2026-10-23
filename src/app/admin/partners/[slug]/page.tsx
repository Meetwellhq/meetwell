import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { date, NotReady, PageTitle } from "@/components/admin/admin-ui";
import { PartnerSummary, type PartnerRow } from "@/components/admin/partners-admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/misc";
import { getSiteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

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

/** One partner: its link, numbers and team, then everyone who joined through it. */
export default async function AdminPartnerPage({ params }: PageProps<"/admin/partners/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_partners");
  if (error) return <NotReady what="Partners" />;
  const partner = ((data ?? []) as PartnerRow[]).find((p) => p.slug === slug);
  if (!partner) notFound();

  const { data: rows } = await supabase.rpc("admin_partner_people", { p_partner: partner.id });
  const people = (rows ?? []) as Person[];
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
        <ul className="divide-y divide-border">
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
        </ul>
      )}
    </section>
  );
}
