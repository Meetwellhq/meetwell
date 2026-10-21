"use server";

import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "../email";
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
  revalidatePath("/dashboard/invites");
  return sent ? { ok: true } : { error: `Code created (${code}) but the email didn't send. Try again.` };
}
