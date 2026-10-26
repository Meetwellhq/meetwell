"use server";

import { sendFeedbackEmail } from "../email";
import { FEEDBACK_KINDS, type FeedbackKind } from "../founder-emails";
import { createClient, getCurrentUser } from "../supabase/server";

export type FeedbackState = { sent?: boolean; error?: string };

/** Sends a signed-in member's feedback to the support inbox (see sendFeedbackEmail). */
export async function sendFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const user = await getCurrentUser();
  if (!user?.email) return { error: "Please log in again." };

  const kind = String(form.get("kind") ?? "");
  const message = String(form.get("message") ?? "").trim();
  const page = String(form.get("page") ?? "").slice(0, 200);
  if (!FEEDBACK_KINDS.includes(kind as FeedbackKind)) return { error: "Pick idea, problem or other." };
  if (message.length < 3) return { error: "Write a few words first." };
  if (message.length > 2000) return { error: "Keep it under 2,000 characters." };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
  const name = profile?.full_name?.trim() || user.email;

  const ok = await sendFeedbackEmail(kind as FeedbackKind, message, { name, email: user.email }, page.startsWith("/") ? page : "/dashboard");
  return ok ? { sent: true } : { error: "That didn't send. Please try again, or email support@meetwell.me." };
}
