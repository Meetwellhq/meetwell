import { isValidResendSignature } from "@/lib/email-webhook-signature";
import { createClient } from "@/lib/supabase/server";

// Resend's event names, and what we keep for each.
const EVENTS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
};

/**
 * Resend tells us when emails are delivered, opened, clicked or bounce (set
 * this URL in Resend: Webhooks, with the signing secret in RESEND_WEBHOOK_SECRET).
 * Every request must carry a valid signature. Only emails sent from the admin's
 * New email page are recorded; other events are ignored.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const valid = isValidResendSignature(
    raw,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    process.env.RESEND_WEBHOOK_SECRET ?? "",
  );
  if (!valid) return Response.json({ error: "invalid signature" }, { status: 401 });

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const type = EVENTS[event.type ?? ""];
  const emailId = event.data?.email_id;
  if (!type || typeof emailId !== "string") return Response.json({ ok: true });

  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error("CRON_SECRET is not set");
    const { error } = await (await createClient()).rpc("record_email_event", {
      p_token: secret,
      p_resend_id: emailId,
      p_type: type,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Resend webhook failed", type, err);
    // A non-200 makes Resend try again later.
    return Response.json({ error: "retry" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
