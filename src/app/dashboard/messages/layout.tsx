import Link from "next/link";
import { ConversationList, MessagesShell } from "@/components/messaging/conversation-list";
import type { ConversationRow } from "@/lib/messaging/types";
import { createClient } from "@/lib/supabase/server";

/** Messages: the conversation list stays on the left while a conversation is open on the right. */
export default async function MessagesLayout({ children }: LayoutProps<"/dashboard/messages">) {
  const { data } = await (await createClient()).rpc("my_conversations");
  const rows = (data ?? []) as ConversationRow[];

  return (
    <div className="flex flex-col gap-6">
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
      <MessagesShell list={<ConversationList rows={rows} />}>{children}</MessagesShell>
    </div>
  );
}
