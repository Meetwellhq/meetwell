import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactsList, type Contact } from "@/components/dashboard/contacts-list";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/misc";
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

export default async function ContactsPage() {
  const supabase = await createClient();
  const [{ data: mine }, { data: savers }] = await Promise.all([supabase.rpc("my_contacts"), supabase.rpc("who_saved_me")]);
  const contacts = (mine ?? []) as Contact[];
  const savedMe = (savers ?? []) as Saver[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-ink-2">Everyone whose card you&apos;ve scanned or opened, in one place.</p>
        </div>
        {contacts.length > 0 && (
          <a href="/dashboard/contacts/export" download className={buttonClass({ variant: "secondary" })}>
            <Download className="size-4" aria-hidden /> Export all to phone
          </a>
        )}
      </div>

      <ContactsList contacts={contacts} />

      {savedMe.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">Saved your card</h2>
          <p className="mt-1 text-sm text-ink-2">Members who kept your card. Open theirs to save them back.</p>
          <ul className="mt-4 divide-y divide-border">
            {savedMe.map((s) => (
              <li key={s.slug} className="flex items-center gap-3 py-3">
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
        </Card>
      )}
    </div>
  );
}
