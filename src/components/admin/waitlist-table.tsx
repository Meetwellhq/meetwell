"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { date, ReminderBadges, type WaitlistRow } from "@/components/admin/admin-ui";
import { InviteButton } from "@/components/admin/invite-button";
import { Input, Select } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Pager } from "@/components/ui/paginated-list";
import { cn } from "@/lib/cn";

const PER_PAGE = 10;
// Column layout shared by the header row and each row (stacked on phones).
const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_11rem] md:items-center md:gap-4";

type Filter = "all" | "waiting" | "invited" | "signed_up" | "unconfirmed";
const FILTERS: { value: Filter; label: string; keep: (r: WaitlistRow) => boolean }[] = [
  { value: "all", label: "Everyone", keep: () => true },
  { value: "waiting", label: "Waiting for an invite", keep: (r) => !r.invited_at && !r.signed_up },
  { value: "invited", label: "Invited, not signed up", keep: (r) => !!r.invited_at && !r.signed_up },
  { value: "signed_up", label: "Signed up", keep: (r) => r.signed_up },
  { value: "unconfirmed", label: "Email not confirmed", keep: (r) => r.signed_up && r.confirmed === false },
];

/** The waiting list as a table: search by name or email, filter by status, 10 a page. */
export function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const needle = q.trim().toLowerCase();
  const keep = FILTERS.find((f) => f.value === filter)!.keep;
  const shown = rows.filter((r) => keep(r) && (!needle || [r.full_name, r.email].some((v) => v?.toLowerCase().includes(needle))));
  const current = Math.min(page, Math.max(1, Math.ceil(shown.length / PER_PAGE)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or email"
            aria-label="Search the waiting list"
            className="pl-9 pr-10"
          />
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
        <div className="sm:w-56">
          <Select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter);
              setPage(1);
            }}
            aria-label="Filter"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState title="No one matches" description="Try another search or filter." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface" role="table" aria-label="Waiting list">
          <div className={cn("hidden border-b border-border bg-surface-2 px-4 py-2.5 text-xs font-medium text-ink-2", COLS)} role="row">
            <span role="columnheader">Person</span>
            <span role="columnheader">Joined</span>
            <span role="columnheader">Invited</span>
            <span role="columnheader" className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-border" role="rowgroup">
            {shown.slice((current - 1) * PER_PAGE, current * PER_PAGE).map((r) => (
              <li key={r.email} role="row" className={cn("flex flex-col gap-3 px-4 py-3.5", COLS)}>
                <div role="cell" className="min-w-0">
                  <p className="truncate font-medium text-ink">{r.full_name || "No name"}</p>
                  <p className="truncate text-sm text-ink-2">{r.email}</p>
                  <p className="mt-1 text-xs text-ink-3 md:hidden">
                    Joined {date(r.joined_at)}
                    {r.invited_at && <> · Invited {date(r.invited_at)}</>}
                  </p>
                  {!!r.reminders?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ReminderBadges reminders={r.reminders} />
                    </div>
                  )}
                </div>
                <span role="cell" className="hidden text-sm text-ink-2 md:block">{date(r.joined_at)}</span>
                <span role="cell" className="hidden text-sm text-ink-2 md:block">{r.invited_at ? date(r.invited_at) : "Not yet"}</span>
                <div role="cell" className="flex md:justify-end">
                  {r.signed_up ? (
                    <Badge tone={r.confirmed === false ? "warning" : "success"}>
                      {r.confirmed === false ? "Email not confirmed" : "Signed up"}
                    </Badge>
                  ) : (
                    <div className="flex flex-col items-start gap-1 md:items-end">
                      {r.code_used && <span className="text-xs text-warning">Code used up · Resend sends a new one</span>}
                      <InviteButton email={r.email} fullName={r.full_name} invited={!!r.invited_at} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Pager page={current} total={shown.length} perPage={PER_PAGE} setPage={setPage} />
    </div>
  );
}
