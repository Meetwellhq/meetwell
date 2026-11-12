import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactsList, SavedByList, type Contact, type Saver } from "@/components/dashboard/contacts-list";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contacts" };

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
          <p className="mt-1 text-ink-2">Everyone you&apos;ve met on Meetwell, and everyone who kept your card.</p>
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

      {savedBy ? <SavedByList savers={savedMe} /> : <ContactsList contacts={contacts} savedMe={savedMe.map((s) => s.slug)} />}
    </div>
  );
}
