"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendNewMessageEmail } from "../email";
import { rateLimit } from "../rate-limit";
import { createClient, getCurrentUser } from "../supabase/server";

export type SendState = { ok?: boolean; error?: string };

const LOCKED: Record<string, string> = {
  ended: "This conversation has ended, so you can't send new messages.",
  blocked: "Messages are blocked in this conversation.",
  paused: "Your messaging is paused while we look at a report.",
  member_first: "The member writes first. You can reply once they do.",
};

/** Sends a message (the database checks every rule), then maybe emails the other person. */
export async function sendMessage(conversationId: number, body: string): Promise<SendState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  if (!rateLimit(`send-message:${user.id}`, 20, 60_000)) return { error: "You're sending quickly. Please wait a moment." };
  const text = body.trim();
  if (!text) return { error: "Write a message first." };
  if (text.length > 2000) return { error: "Keep messages under 2,000 characters." };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("send_message", { p_conversation: conversationId, p_body: text });
  if (error) {
    const lock = /Locked: (\w+)/.exec(error.message)?.[1];
    if (lock && LOCKED[lock]) return { error: LOCKED[lock] };
    if (error.code === "54000") return { error: "You've sent a lot of messages in the last hour. Please try again later." };
    console.error("send_message failed", error.code, error.message);
    return { error: "Couldn't send. Please try again." };
  }

  // Email alert: the database decides (alerts on, still unread, not emailed in the last 6 hours).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const { data: due } = await supabase.rpc("claim_message_email", { p_token: secret, p_message: id });
    const row = (due as { email: string; full_name: string | null; sender_name: string; unsubscribe_token: string }[] | null)?.[0];
    if (row) {
      await sendNewMessageEmail(row.email, row.full_name, {
        senderName: row.sender_name,
        conversationId,
        offToken: row.unsubscribe_token,
      });
    }
  }

  revalidatePath("/dashboard/messages", "layout");
  return { ok: true };
}

export async function markConversationRead(conversationId: number) {
  if (!(await getCurrentUser())) return;
  await (await createClient()).rpc("mark_conversation_read", { p_conversation: conversationId });
}

export async function setBlocked(conversationId: number, blocked: boolean): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("set_block", { p_conversation: conversationId, p_blocked: blocked });
  if (error) return { error: "Couldn't update. Please try again." };
  revalidatePath("/dashboard/messages", "layout");
  return {};
}

const REASONS = ["harassment", "spam", "scam", "inappropriate", "other"] as const;

export async function reportMessage(messageId: number, reason: string, note: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  if (!rateLimit(`report:${user.id}`, 10, 60_000)) return { error: "Please wait a moment and try again." };
  const parsed = z.object({ reason: z.enum(REASONS), note: z.string().max(500) }).safeParse({ reason, note });
  if (!parsed.success) return { error: "Pick a reason." };
  const { error } = await (await createClient()).rpc("report_message", {
    p_message: messageId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });
  if (error) return { error: "Couldn't send the report. Please try again." };
  return { ok: true };
}

export async function setMessageEmails(on: boolean): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("set_message_emails", { p_on: on });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/settings");
  return {};
}

export type UnsubscribeMessagesState = { done?: boolean; error?: string };

/** One-click "turn off message emails" from an email link (no login). */
export async function unsubscribeMessageEmails(_: UnsubscribeMessagesState, formData: FormData): Promise<UnsubscribeMessagesState> {
  const token = z.uuid().safeParse(formData.get("token"));
  if (!token.success) return { error: "This link isn't valid. Turn emails off in Settings instead." };
  const { data, error } = await (await createClient()).rpc("unsubscribe_message_emails", { p_token: token.data });
  if (error || data !== true) return { error: "This link isn't valid. Turn emails off in Settings instead." };
  return { done: true };
}
