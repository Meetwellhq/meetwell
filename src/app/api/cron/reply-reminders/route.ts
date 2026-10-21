import { sendReplyReminderEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Waiting = {
  email: string;
  full_name: string | null;
  sender_name: string;
  sender_title: string | null;
  sender_avatar: string | null;
  preview: string;
  conversation_id: number;
  to_mentor: boolean;
  unsubscribe_token: string;
};

/**
 * "Tunde is waiting for your reply": for messages unanswered for 4 hours, once
 * each. Called every 15 minutes by Supabase pg_cron (Vercel Hobby crons only run
 * daily) with `Authorization: Bearer <CRON_SECRET>`; the database checks the
 * same secret again.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_reply_reminders", { p_token: secret, p_limit: 40 });
  if (error) {
    console.error("claim_reply_reminders failed", error.code, error.message);
    return Response.json({ error: "claim_failed" }, { status: 500 });
  }

  const tally = { sent: 0, failed: 0 };
  for (const w of (data ?? []) as Waiting[]) {
    const ok = await sendReplyReminderEmail(w.email, w.full_name, {
      senderName: w.sender_name,
      senderTitle: w.sender_title,
      senderAvatar: w.sender_avatar,
      preview: w.preview,
      conversationId: w.conversation_id,
      offToken: w.unsubscribe_token,
      toMentor: w.to_mentor,
    });
    if (ok) tally.sent++;
    else tally.failed++;
    await pause(600);
  }
  if (tally.sent || tally.failed) console.log("Reply reminders", JSON.stringify(tally));
  return Response.json({ ok: true, ...tally });
}
