import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import type { ConversationRow } from "@/lib/messaging/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

const when = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("en-GB", {
    ...(sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }),
    timeZone: "Africa/Lagos",
  });
};

export default async function MessagesPage() {
  const { data } = await (await createClient()).rpc("my_conversations");
  const rows = (data ?? []) as ConversationRow[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Messages</h1>
        <p className="mt-1 text-ink-2">
          Private conversations with people you&apos;re connected to on Meetwell. Please keep to our{" "}
          <Link href="/community-rules" className="text-accent underline">
            community rules
          </Link>
          .
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState title="No conversations yet" description="When a conversation starts, it will show up here." />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                <Avatar name={c.other_name} src={c.other_avatar} className="size-11 shrink-0 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`truncate text-ink ${c.unread > 0 ? "font-semibold" : "font-medium"}`}>{c.other_name}</p>
                    {c.last_message_at && <p className="shrink-0 text-xs text-ink-3">{when(c.last_message_at)}</p>}
                  </div>
                  <p className={`truncate text-sm ${c.unread > 0 ? "text-ink" : "text-ink-2"}`}>
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
          ))}
        </ul>
      )}
    </div>
  );
}
