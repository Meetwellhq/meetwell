import "server-only";
import { APP_NAME, getSiteUrl, SUPPORT_EMAIL } from "./config";
import { FOUNDER_NAME, waitlistEmail } from "./waitlist-email";

// A personal note from the founder. Replies go to SUPPORT_EMAIL.
const FROM = `${FOUNDER_NAME} from ${APP_NAME} <noreply@meetwell.me>`;

/**
 * Sends the "thanks for joining the private beta" email through Resend's API.
 * Needs RESEND_API_KEY (server-only). Without it the email is skipped, so
 * local development works without sending anything.
 */
export async function sendWaitlistEmail(to: string, fullName: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY is not set; skipping waitlist email");
    return false;
  }
  const site = getSiteUrl();
  const { subject, text, html } = waitlistEmail({
    fullName,
    appName: APP_NAME,
    siteUrl: site,
    photoUrl: `${site}/founder/rasheed.jpg`,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: SUPPORT_EMAIL, subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Waitlist email failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Waitlist email failed", err);
    return false;
  }
}
