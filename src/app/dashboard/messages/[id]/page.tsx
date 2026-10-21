import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Thread } from "@/components/messaging/thread";
import type { ConversationRow, MessageRow } from "@/lib/messaging/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

export default async function ConversationPage({ params }: PageProps<"/dashboard/messages/[id]">) {
  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) notFound();

  const supabase = await createClient();
  const [{ data: list }, { data: messages, error }] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase.rpc("my_messages", { p_conversation: conversationId }),
  ]);
  const conversation = ((list ?? []) as ConversationRow[]).find((c) => Number(c.id) === conversationId);
  if (!conversation || error) notFound();

  return <Thread conversation={conversation} messages={(messages ?? []) as MessageRow[]} />;
}
