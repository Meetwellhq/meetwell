"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
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

/** Every conversation with a preview of the last message; the open one is highlighted. */
export function ConversationList({ rows }: { rows: ConversationRow[] }) {
  const pathname = usePathname();

  if (rows.length === 0) {
    return <EmptyState title="No conversations yet" description="When a conversation starts, it will show up here." />;
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((c) => {
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
