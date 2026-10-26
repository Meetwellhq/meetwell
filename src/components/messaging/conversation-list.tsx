"use client";

import { Check, EllipsisVertical, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import type { ConversationRow } from "@/lib/messaging/types";

const when = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("en-GB", {
    ...(sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }),
    timeZone: "Africa/Lagos",
  });
};

type ReadFilterValue = "all" | "unread" | "read";
const READ_OPTIONS: { value: ReadFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

/** A "more" button beside the search that opens All / Unread / Read. A dot shows while a filter is on. */
function ReadFilter({ value, onChange }: { value: ReadFilterValue; onChange: (v: ReadFilterValue) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="read-filter"
        aria-label={`Show: ${READ_OPTIONS.find((o) => o.value === value)!.label}`}
        title="Filter"
        className="relative grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2 hover:bg-border hover:text-ink"
      >
        <EllipsisVertical className="size-5" aria-hidden />
        {value !== "all" && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
      </button>
      {open && (
        <div
          id="read-filter"
          role="radiogroup"
          aria-label="Show"
          className="absolute right-0 top-full z-20 mt-1 flex w-36 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          {READ_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value === o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex items-center rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-2"
            >
              {o.label}
              {value === o.value && <Check className="ml-auto size-4 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Every conversation with a preview of the last message, and a search on top; the open one is highlighted. */
export function ConversationList({ rows }: { rows: ConversationRow[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [read, setRead] = useState<ReadFilterValue>("all");
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(
    (c) =>
      (!needle || [c.other_name, c.other_title, c.last_message].some((v) => v?.toLowerCase().includes(needle))) &&
      (read === "all" || (read === "unread" ? c.unread > 0 : c.unread === 0)),
  );

  if (rows.length === 0) {
    return <EmptyState title="No conversations yet" description="When a conversation starts, it will show up here." />;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 flex gap-2 border-b border-border bg-surface p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search messages" className="h-10 pl-9 pr-10" />
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
        <ReadFilter value={read} onChange={setRead} />
      </div>
      {shown.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-3">No one matches.</p>}
    <ul className="divide-y divide-border">
      {shown.map((c) => {
        const href = `/dashboard/messages/${c.id}`;
        const active = pathname === href;
        return (
          <li key={c.id}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 px-4 py-3.5", active ? "bg-surface-2" : "hover:bg-surface-2")}
            >
              <Avatar name={c.other_name} src={c.other_avatar} className="size-11 shrink-0 text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={cn("truncate text-ink", c.unread > 0 ? "font-semibold" : "font-medium")}>{c.other_name}</p>
                  {c.last_message_at && (
                    <p className="shrink-0 text-xs text-ink-3" suppressHydrationWarning>
                      {when(c.last_message_at)}
                    </p>
                  )}
                </div>
                <p className={cn("truncate text-sm", c.unread > 0 ? "text-ink" : "text-ink-2")}>
                  {c.last_message
                    ? `${c.last_message_mine ? "You: " : ""}${c.last_message}`
                    : c.role === "member"
                      ? "Say hello and introduce yourself."
                      : "They'll write first."}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                  {c.unread}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

/**
 * One box with two panes from laptops up: the list on the left, the open
 * conversation on the right, split by a line. On phones one at a time: the
 * list, or the conversation (with a back arrow).
 */
export function MessagesShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const inThread = pathname !== "/dashboard/messages";
  return (
    // One box: the list and the conversation, split by a single line.
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface lg:grid lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className={cn("overflow-y-auto lg:border-r lg:border-border", inThread && "hidden lg:block")}>{list}</div>
      {/* Phones, no conversation open: only the page's payment notes show, above the list. */}
      <div className={cn("min-h-0 min-w-0", !inThread && "order-first lg:order-none")}>{children}</div>
    </div>
  );
}
