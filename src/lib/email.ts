import "server-only";
import { APP_NAME, getSiteUrl, SUPPORT_EMAIL } from "./config";

const FROM = `${APP_NAME} <noreply@meetwell.me>`;

/**
 * Sends the "you're on the waiting list" email through Resend's API.
 * Needs RESEND_API_KEY (server-only). Without it the email is skipped, so
 * local development works without sending anything.
 */
export async function sendWaitlistEmail(to: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY is not set; skipping waitlist email");
    return false;
  }
  const site = getSiteUrl();
  const text = [
    "Hi there,",
    "",
    `Thanks for joining the ${APP_NAME} waiting list! ${APP_NAME} is in private beta, and we're letting people in gradually.`,
    "",
    "We'll email you as soon as your invite is ready, so you can create your networking card and QR code.",
    "",
    `Questions? Just reply or write to ${SUPPORT_EMAIL}.`,
    "",
    `— The ${APP_NAME} team`,
    site,
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1c1c1a;line-height:1.6">
  <p style="font-size:20px;font-weight:600;color:#1f4d3f;margin:0 0 24px">${APP_NAME}</p>
  <h1 style="font-size:22px;margin:0 0 16px">You're on the waiting list 🎉</h1>
  <p>Thanks for joining the ${APP_NAME} waiting list! ${APP_NAME} is in private beta, and we're letting people in gradually.</p>
  <p>We'll email you as soon as your invite is ready, so you can create your networking card and QR code.</p>
  <p style="color:#5c5c57;font-size:14px;margin-top:32px">Questions? Just reply or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1f4d3f">${SUPPORT_EMAIL}</a>.</p>
  <p style="color:#5c5c57;font-size:14px">— The ${APP_NAME} team · <a href="${site}" style="color:#1f4d3f">${site.replace(/^https?:\/\//, "")}</a></p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: SUPPORT_EMAIL,
        subject: `You've joined the ${APP_NAME} waiting list`,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Waitlist email failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Waitlist email failed", err);
    return false;
  }
}
