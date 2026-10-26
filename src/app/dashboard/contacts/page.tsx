import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactsList, type Contact } from "@/components/dashboard/contacts-list";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contacts" };

type Saver = {
  slug: string;
  full_name: string;
  avatar_url: string | null;
  professional_title: string | null;
  organization: string | null;
  saved_at: string;
  saved_back: boolean;
};

/** Two tabs: the cards I've kept, and the members who kept mine (`?tab=saved-by`). */
export default async function ContactsPage({ searchParams }: PageProps<"/dashboard/contacts">) {
  const supabase = await createClient();
  const [{ tab }, { data: mine }, { data: savers }] = await Promise.all([
    searchParams,
    supabase.rpc("my_contacts"),
    supabase.rpc("who_saved_me"),
  ]);
  const contacts = (mine ?? []) as Contact[];
  const savedMe = (savers ?? []) as Saver[];
  const savedBy = tab === "saved-by";
  const tabs = [
    { href: "/dashboard/contacts", label: "Contacts saved", count: contacts.length, active: !savedBy },
    { href: "/dashboard/contacts?tab=saved-by", label: "Saved by people", count: savedMe.length, active: savedBy },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-ink-2">
            {savedBy ? "Members who kept your card. Open theirs to save them back." : "Everyone whose card you've scanned or opened, in one place."}
          </p>
        </div>
        {!savedBy && contacts.length > 0 && (
          <a href="/dashboard/contacts/export" download className={buttonClass({ variant: "secondary" })}>
            <Download className="size-4" aria-hidden /> Export all to phone
          </a>
        )}
      </div>

      <nav className="inline-flex self-start rounded-full bg-surface-2 p-1" aria-label="Contacts">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-sm", t.active ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
          >
            {t.label} <span className="tabular-nums text-ink-3">{t.count}</span>
          </Link>
        ))}
      </nav>

      {!savedBy ? (
        <ContactsList contacts={contacts} />
      ) : savedMe.length === 0 ? (
        <div className="rounded-xl border border-border">
          <EmptyState title="No one yet" description="When a member keeps your card, they show up here so you can save them back." />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {savedMe.map((s) => (
            <li key={s.slug} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={s.full_name} src={s.avatar_url} className="size-10 shrink-0 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{s.full_name}</p>
                <p className="truncate text-sm text-ink-2">{[s.professional_title, s.organization].filter(Boolean).join(" · ")}</p>
              </div>
              {s.saved_back ? (
                <Badge tone="success">In your contacts</Badge>
              ) : (
                <Link href={`/p/${s.slug}`} className={buttonClass({ size: "sm" })}>Save back</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
