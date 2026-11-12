"use client";

import { Check, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Input, Select } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Pager } from "@/components/ui/paginated-list";
import { useToast } from "@/components/ui/toast";
import { adminSetIdeaDone } from "@/lib/admin/actions";

export type IdeaRow = {
  id: number;
  kind: "idea" | "problem" | "other";
  message: string;
  page: string | null;
  done_at: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  profile_slug: string | null;
};

const PER_PAGE = 10;
const KIND = { idea: { label: "Idea", tone: "accent" }, problem: { label: "Problem", tone: "warning" }, other: { label: "Other", tone: "neutral" } } as const;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/** Every idea members sent: search, filter by type and status, 10 a page, mark done. */
export function IdeasList({ rows }: { rows: IdeaRow[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | IdeaRow["kind"]>("all");
  const [status, setStatus] = useState<"new" | "done" | "all">("new");
  const [page, setPage] = useState(1);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (kind === "all" || r.kind === kind) &&
      (status === "all" || (status === "new" ? !r.done_at : !!r.done_at)) &&
      (!needle || [r.message, r.full_name, r.email].some((v) => v?.toLowerCase().includes(needle))),
  );
  const current = Math.min(page, Math.max(1, Math.ceil(shown.length / PER_PAGE)));
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Search ideas, names or emails" aria-label="Search ideas" className="pl-9 pr-10" />
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
          <div className="sm:w-36">
            <Select value={kind} onChange={(e) => reset(setKind)(e.target.value as typeof kind)} aria-label="Type">
              <option value="all">All types</option>
              <option value="idea">Ideas</option>
              <option value="problem">Problems</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="sm:w-32">
            <Select value={status} onChange={(e) => reset(setStatus)(e.target.value as typeof status)} aria-label="Status">
              <option value="new">New</option>
              <option value="done">Done</option>
              <option value="all">All</option>
            </Select>
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState title={rows.length === 0 ? "No ideas yet" : "Nothing here"} description={rows.length === 0 ? "When members send an idea from their menu, it shows up here." : "Try another search or filter."} />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {shown.slice((current - 1) * PER_PAGE, current * PER_PAGE).map((r) => (
            <IdeaItem key={r.id} idea={r} />
          ))}
        </ul>
      )}
      <Pager page={current} total={shown.length} perPage={PER_PAGE} setPage={setPage} />
    </div>
  );
}

function IdeaItem({ idea: r }: { idea: IdeaRow }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const k = KIND[r.kind];
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={k.tone}>{k.label}</Badge>
          {r.done_at && <Badge tone="success">Done</Badge>}
          <span className="text-xs text-ink-3">{when(r.created_at)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] text-ink">{r.message}</p>
        <p className="mt-2 text-sm text-ink-2">
          {r.profile_slug ? (
            <Link href={`/p/${r.profile_slug}`} target="_blank" className="font-medium text-ink hover:underline">
              {r.full_name || "A member"}
            </Link>
          ) : (
            <span className="font-medium text-ink">{r.full_name || "A member"}</span>
          )}
          {r.email && (
            <>
              {" · "}
              <a href={`mailto:${r.email}`} className="text-accent hover:underline">{r.email}</a>
            </>
          )}
          {r.page && <span className="text-ink-3"> · from {r.page}</span>}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { error } = await adminSetIdeaDone(r.id, !r.done_at);
            if (error) toast(error, "error");
            else toast(r.done_at ? "Marked as new." : "Marked as done.");
          })
        }
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
      >
        {r.done_at ? <RotateCcw className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
        {r.done_at ? "Mark as new" : "Mark as done"}
      </button>
    </li>
  );
}
