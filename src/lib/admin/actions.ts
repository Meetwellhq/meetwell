"use server";

import { revalidatePath } from "next/cache";
import { sendInviteEmail, sendSparkBetaEmail } from "../email";
import { createClient, getCurrentUser } from "../supabase/server";
import { emailSchema } from "../validation";

export type InviteState = { ok?: boolean; error?: string };

/**
 * Invite one person from the waiting list: create (or reuse) their personal
 * access code, then email it. The database refuses anyone who isn't an admin.
 */
export async function inviteFromWaitlist(_: InviteState, formData: FormData): Promise<InviteState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Invalid email." };
  const fullName = String(formData.get("fullName") ?? "").slice(0, 80) || null;

  const supabase = await createClient();
  const { data: code, error } = await supabase.rpc("admin_invite", { p_email: email.data });
  if (error || typeof code !== "string") {
    console.error("admin_invite failed", error?.code, error?.message);
    return { error: error?.code === "42501" ? "You don't have access to invites." : "Couldn't create the invite." };
  }

  const sent = await sendInviteEmail(email.data, fullName, code);
  revalidatePath("/admin", "layout");
  return sent ? { ok: true } : { error: `Code created (${code}) but the email didn't send. Try again.` };
}

export type AnnounceState = { sent?: number; failed?: number; remaining?: number; error?: string };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Email the Spark beta announcement to members who haven't had it yet, in
 * paced batches (Resend rate limit, ~60s function limit). Each person is
 * recorded only after their email went out, so a failed send is retried on
 * the next click. The database refuses anyone who isn't an admin.
 */
export async function sendSparkAnnouncement(): Promise<AnnounceState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_announcement_recipients", { p_kind: "spark_beta", p_limit: 40 });
  if (error) {
    console.error("admin_announcement_recipients failed", error.code, error.message);
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't load the members." };
  }

  const started = Date.now();
  let sent = 0;
  let failed = 0;
  for (const r of (data ?? []) as { email: string; full_name: string | null }[]) {
    if (Date.now() - started > 40_000) break;
    if (await sendSparkBetaEmail(r.email, r.full_name)) {
      await supabase.rpc("admin_mark_announced", { p_kind: "spark_beta", p_email: r.email });
      sent++;
    } else {
      failed++;
    }
    await pause(600);
  }

  const { data: status } = await supabase.rpc("admin_announcement_status", { p_kind: "spark_beta" });
  const remaining = (status as { remaining: number }[] | null)?.[0]?.remaining;
  revalidatePath("/admin", "layout");
  return { sent, failed, remaining };
}
