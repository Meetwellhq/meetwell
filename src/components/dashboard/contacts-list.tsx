"use client";

import { ArrowUpRight, Pencil, Search, Trash2, UserRoundPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { removeContact, setContactNote } from "@/lib/contacts/actions";

export type Contact = {
  slug: string;
  full_name: string;
  avatar_url: string | null;
  professional_title: string | null;
  organization: string | null;
  note: string | null;
  source: "qr" | "link";
  saved_at: string;
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** My phone book: search, a note per person, save one to the phone, or remove. */
export function ContactsList({ contacts }: { contacts: Contact[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? contacts.filter((c) =>
        [c.full_name, c.professional_title, c.organization, c.note].some((v) => v?.toLowerCase().includes(needle)),
      )
    : contacts;

  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-border">
        <EmptyState
          title="No contacts yet"
          description="When you open someone's Meetwell card, by scanning their QR code or from a link, they're kept here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company or note" aria-label="Search contacts" className="pl-9" />
      </div>
      {shown.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-ink-3">No one matches “{q}”.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {shown.map((c) => (
            <ContactRow key={c.slug} contact={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactRow({ contact: c }: { contact: Contact }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(c.note ?? "");
  const [pending, start] = useTransition();
  const subtitle = [c.professional_title, c.organization].filter(Boolean).join(" · ");

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start gap-3">
        <Avatar name={c.full_name} src={c.avatar_url} className="size-11 shrink-0 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{c.full_name}</p>
          {subtitle && <p className="truncate text-sm text-ink-2">{subtitle}</p>}
          <p className="mt-0.5 text-xs text-ink-3">
            {c.source === "qr" ? "Scanned their QR code" : "Opened their card"} · {day(c.saved_at)}
          </p>
          {!editing && c.note && <p className="mt-1.5 text-sm text-ink">{c.note}</p>}
        </div>
        <button
          type="button"
          aria-label={`Remove ${c.full_name}`}
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove ${c.full_name} from your contacts?`)) return;
            start(async () => {
              const res = await removeContact(c.slug);
              if (res.error) toast(res.error, "error");
            });
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {editing && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await setContactNote(c.slug, note);
              if (res.error) toast(res.error, "error");
              else setEditing(false);
            });
          }}
        >
          <Input autoFocus value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Where you met, what you talked about" aria-label="Note" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={pending}>Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={`/p/${c.slug}/vcard`} className={buttonClass({ size: "sm", variant: "secondary" })}>
          <UserRoundPlus className="size-4" aria-hidden /> Save to phone
        </a>
        <a href={`/p/${c.slug}`} className={buttonClass({ size: "sm", variant: "ghost" })}>
          Open card <ArrowUpRight className="size-4" aria-hidden />
        </a>
        {!editing && (
          <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
            {c.note ? "Edit note" : "Add note"}
          </Button>
        )}
      </div>
    </li>
  );
}
