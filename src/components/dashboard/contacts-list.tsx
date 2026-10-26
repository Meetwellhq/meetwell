"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Search, Trash2, UserRoundPlus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
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

/** A member who kept my card (who_saved_me). */
export type Saver = {
  slug: string;
  full_name: string;
  avatar_url: string | null;
  professional_title: string | null;
  organization: string | null;
  saved_at: string;
  saved_back: boolean;
};

const PER_PAGE = 10;
type Sort = "newest" | "oldest" | "name";

const matches = (needle: string, ...values: (string | null)[]) => !needle || values.some((v) => v?.toLowerCase().includes(needle));

function sorted<T extends { full_name: string; saved_at: string }>(rows: T[], sort: Sort) {
  return [...rows].sort((a, b) =>
    sort === "name" ? a.full_name.localeCompare(b.full_name) : sort === "oldest" ? a.saved_at.localeCompare(b.saved_at) : b.saved_at.localeCompare(a.saved_at),
  );
}

/** Search, filter, sort and pages, shared by both tabs. Changing any of them goes back to page 1. */
function useBrowse<F extends string>(initialFilter: F) {
  const [q, setQ] = useState("");
  const [filter, setFilterState] = useState<F>(initialFilter);
  const [sort, setSortState] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  return {
    q,
    needle: q.trim().toLowerCase(),
    filter,
    sort,
    page,
    setPage,
    setQ: (v: string) => (setQ(v), setPage(1)),
    setFilter: (v: F) => (setFilterState(v), setPage(1)),
    setSort: (v: Sort) => (setSortState(v), setPage(1)),
  };
}

function Toolbar<F extends string>({
  q,
  setQ,
  placeholder,
  filter,
  setFilter,
  filters,
  sort,
  setSort,
}: {
  q: string;
  setQ: (v: string) => void;
  placeholder: string;
  filter: F;
  setFilter: (v: F) => void;
  filters: { value: F; label: string }[];
  sort: Sort;
  setSort: (v: Sort) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search" className="pl-9 pr-10" />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as F)} aria-label="Filter" className="sm:w-44">
          {filters.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="sm:w-36">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A to Z</option>
        </Select>
      </div>
    </div>
  );
}

/** "Showing 1 to 10 of 24" and the page buttons (the same look as the admin Users page). */
function Pager({ page, total, setPage }: { page: number; total: number; setPage: (n: number) => void }) {
  const pages = Math.ceil(total / PER_PAGE);
  if (pages <= 1) return null;
  const go = (n: number) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cls = "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm tabular-nums transition-colors";
  const idle = "border-border text-ink-2 hover:border-border-strong hover:text-ink disabled:pointer-events-none disabled:opacity-50";
  return (
    <nav className="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Pages">
      <p className="text-sm text-ink-2">
        Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={cn(cls, idle)} disabled={page === 1} onClick={() => go(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
          .map((n, i, list) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - list[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
              <button
                type="button"
                onClick={() => go(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={cn(cls, n === page ? "border-accent bg-accent-soft font-medium text-accent" : idle)}
              >
                {n}
              </button>
            </span>
          ))}
        <button type="button" className={cn(cls, idle)} disabled={page === pages} onClick={() => go(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border">
      <EmptyState title={title} description={children} />
    </div>
  );
}

/** Column layout of each table's rows (stacked on phones). */
const CONTACT_COLS = "sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_6.5rem_9.5rem] sm:items-center sm:gap-4";
const SAVER_COLS = "sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_9rem] sm:items-center sm:gap-4";

type ContactFilter = "all" | "qr" | "link" | "note" | "mutual";

/** My phone book: search, filter, sort and pages; a note per person, save one to the phone, or remove. */
export function ContactsList({ contacts, savedMe }: { contacts: Contact[]; savedMe: string[] }) {
  const b = useBrowse<ContactFilter>("all");
  const mutual = new Set(savedMe);

  if (contacts.length === 0) {
    return (
      <Empty title="No contacts yet">
        When you open someone&apos;s Meetwell card, by scanning their QR code or from a link, they&apos;re kept here.
      </Empty>
    );
  }

  const shown = sorted(
    contacts.filter(
      (c) =>
        matches(b.needle, c.full_name, c.professional_title, c.organization, c.note) &&
        (b.filter === "all" ||
          (b.filter === "qr" && c.source === "qr") ||
          (b.filter === "link" && c.source === "link") ||
          (b.filter === "note" && !!c.note) ||
          (b.filter === "mutual" && mutual.has(c.slug))),
    ),
    b.sort,
  );

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        {...b}
        placeholder="Search name, company or note"
        filters={[
          { value: "all", label: "All contacts" },
          { value: "qr", label: "Scanned QR code" },
          { value: "link", label: "Opened a link" },
          { value: "note", label: "With a note" },
          { value: "mutual", label: "Saved you back" },
        ]}
      />
      {shown.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-ink-3">No one matches.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border" role="table" aria-label="Contacts saved">
          <ul className="divide-y divide-border" role="rowgroup">
            {shown.slice((b.page - 1) * PER_PAGE, b.page * PER_PAGE).map((c) => (
              <ContactRow key={c.slug} contact={c} />
            ))}
          </ul>
        </div>
      )}
      <Pager page={b.page} total={shown.length} setPage={b.setPage} />
    </div>
  );
}

type SaverFilter = "all" | "not-back" | "back";

/** Members who kept my card, with a way to save them back. */
export function SavedByList({ savers }: { savers: Saver[] }) {
  const b = useBrowse<SaverFilter>("all");

  if (savers.length === 0) {
    return <Empty title="No one yet">When a member keeps your card, they show up here so you can save them back.</Empty>;
  }

  const shown = sorted(
    savers.filter(
      (s) =>
        matches(b.needle, s.full_name, s.professional_title, s.organization) &&
        (b.filter === "all" || (b.filter === "back" ? s.saved_back : !s.saved_back)),
    ),
    b.sort,
  );

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        {...b}
        placeholder="Search name or company"
        filters={[
          { value: "all", label: "Everyone" },
          { value: "not-back", label: "Not saved back yet" },
          { value: "back", label: "In your contacts" },
        ]}
      />
      {shown.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-ink-3">No one matches.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border" role="table" aria-label="Saved by people">
          <ul className="divide-y divide-border" role="rowgroup">
            {shown.slice((b.page - 1) * PER_PAGE, b.page * PER_PAGE).map((s) => (
              <li key={s.slug} role="row" className={cn("flex items-center gap-3 px-4 py-3", SAVER_COLS)}>
                <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={s.full_name} src={s.avatar_url} className="size-10 shrink-0 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{s.full_name}</p>
                    <p className="truncate text-sm text-ink-2">{[s.professional_title, s.organization].filter(Boolean).join(" · ")}</p>
                    <p className="mt-0.5 text-xs text-ink-3 sm:hidden">Saved your card · {day(s.saved_at)}</p>
                  </div>
                </div>
                <span role="cell" className="hidden text-sm text-ink-2 sm:block">{day(s.saved_at)}</span>
                <div role="cell" className="shrink-0 text-right">
                  {s.saved_back ? (
                    <Badge tone="success">In your contacts</Badge>
                  ) : (
                    <Link href={`/p/${s.slug}`} className={buttonClass({ size: "sm" })}>Save back</Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Pager page={b.page} total={shown.length} setPage={b.setPage} />
    </div>
  );
}

function ContactRow({ contact: c }: { contact: Contact }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(c.note ?? "");
  const [pending, start] = useTransition();
  const subtitle = [c.professional_title, c.organization].filter(Boolean).join(" · ");
  const met = c.source === "qr" ? "Scanned QR code" : "Opened their card";

  const icon = "grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink";

  return (
    <li role="row" className="px-4 py-3">
      <div className={cn("flex flex-col gap-3", CONTACT_COLS)}>
        <div role="cell" className="flex min-w-0 items-start gap-3">
          <Avatar name={c.full_name} src={c.avatar_url} className="size-10 shrink-0 text-sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{c.full_name}</p>
            {subtitle && <p className="truncate text-sm text-ink-2">{subtitle}</p>}
            <p className="mt-0.5 text-xs text-ink-3 sm:hidden">
              {met} · {day(c.saved_at)}
            </p>
            {!editing && c.note && <p className="mt-1.5 text-sm text-ink">{c.note}</p>}
          </div>
        </div>
        <span role="cell" className="hidden text-sm text-ink-2 sm:block">{met}</span>
        <span role="cell" className="hidden text-sm text-ink-2 sm:block">{day(c.saved_at)}</span>
        <div role="cell" className="-ml-2 flex items-center gap-0.5 sm:ml-0 sm:justify-end">
          <a href={`/p/${c.slug}/vcard`} className={icon} aria-label={`Save ${c.full_name} to your phone`} title="Save to phone">
            <UserRoundPlus className="size-4" aria-hidden />
          </a>
          <a href={`/p/${c.slug}`} className={icon} aria-label={`Open the card of ${c.full_name}`} title="Open card">
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
          <button type="button" className={icon} onClick={() => setEditing(true)} aria-label={c.note ? "Edit note" : "Add note"} title={c.note ? "Edit note" : "Add note"}>
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Remove ${c.full_name}`}
            title="Remove"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Remove ${c.full_name} from your contacts?`)) return;
              start(async () => {
                const res = await removeContact(c.slug);
                if (res.error) toast(res.error, "error");
              });
            }}
            className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {editing && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
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
    </li>
  );
}
