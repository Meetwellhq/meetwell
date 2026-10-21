import { getSiteUrl } from "@/lib/config";
import {
  sendDraftReminderEmail,
  sendIncompleteProfileEmail,
  sendInviteReminderEmail,
  sendNoScansEmail,
} from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

// Sending is paced to stay under Resend's rate limit, so allow time for a full batch.
export const maxDuration = 60;

type Reminder = {
  kind: "invite_unused" | "email_unconfirmed" | "card_draft" | "no_scans" | "profile_incomplete";
  email: string;
  full_name: string | null;
  access_code: string | null;
  completeness?: number | null;
  has_photo?: boolean | null;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Daily job (see vercel.json). Vercel sends `Authorization: Bearer <CRON_SECRET>`;
 * the same secret is checked again by the database before any reminder is claimed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_reminders", { p_token: secret, p_limit: 40 });
  if (error) {
    console.error("claim_reminders failed", error.code, error.message);
    return Response.json({ error: "claim_failed" }, { status: 500 });
  }

  const results: Record<string, { sent: number; failed: number }> = {};
  for (const r of (data ?? []) as Reminder[]) {
    let ok = false;
    if (r.kind === "invite_unused" && r.access_code) {
      ok = await sendInviteReminderEmail(r.email, r.full_name, r.access_code);
    } else if (r.kind === "card_draft") {
      ok = await sendDraftReminderEmail(r.email, r.full_name);
    } else if (r.kind === "profile_incomplete" && typeof r.completeness === "number") {
      ok = await sendIncompleteProfileEmail(r.email, r.full_name, r.completeness, r.has_photo === true);
    } else if (r.kind === "no_scans") {
      ok = await sendNoScansEmail(r.email, r.full_name);
    } else if (r.kind === "email_unconfirmed") {
      // Supabase re-sends its own confirmation email.
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: r.email,
        options: { emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/onboarding` },
      });
      ok = !resendError;
      if (resendError) console.error("Confirmation resend failed", resendError.code, resendError.message);
    }
    const tally = (results[r.kind] ??= { sent: 0, failed: 0 });
    if (ok) tally.sent++;
    else tally.failed++;
    await pause(600);
  }

  console.log("Reminders run", JSON.stringify(results));
  return Response.json({ ok: true, results });
}
