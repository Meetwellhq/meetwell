"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";

type Option = { value: string; label: string };

const selectClass =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors hover:border-border-strong focus:border-accent focus:outline-none";

/**
 * Search and filters for the admin Users list. A plain GET form, so the page
 * stays server-rendered and every view has its own link; picking a filter
 * submits straight away and always goes back to page 1.
 */
export function UsersToolbar({
  q,
  role,
  card,
  sort,
  roles,
  cards,
  sorts,
}: {
  q: string;
  role: string;
  card: string;
  sort: string;
  roles: Option[];
  cards: Option[];
  sorts: Option[];
}) {
  const filtered = q !== "" || role !== "all" || card !== "all" || sort !== "newest";
  const submit = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <form method="get" action="/admin/users" className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <label className="relative flex-1">
        <span className="sr-only">Search users</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email"
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-3 gap-2 lg:flex">
        <label>
          <span className="sr-only">Role</span>
          <select name="role" defaultValue={role} onChange={submit} className={`${selectClass} w-full`}>
            {roles.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Card</span>
          <select name="card" defaultValue={card} onChange={submit} className={`${selectClass} w-full`}>
            {cards.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort</span>
          <select name="sort" defaultValue={sort} onChange={submit} className={`${selectClass} w-full`}>
            {sorts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Search
        </button>
        {filtered && (
          <Link
            href="/admin/users"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-ink-2 transition-colors hover:border-border-strong hover:text-ink"
          >
            <X className="size-4" aria-hidden />
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
