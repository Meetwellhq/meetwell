import "server-only";
import { APP_NAME, getSiteUrl, SUPPORT_EMAIL } from "./config";

/** The name comes from a public form, so escape it before putting it in HTML. */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// A personal note from the founder. Replies go to SUPPORT_EMAIL.
const FOUNDER = "Rasheed";
const FROM = `${FOUNDER} from ${APP_NAME} <noreply@meetwell.me>`;

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
  const firstName = fullName.trim().split(/\s+/)[0] || "there";

  const paragraphs = [
    `Thank you for joining the ${APP_NAME} private beta.`,
    `I'm ${FOUNDER}, the founder. I'm building ${APP_NAME} so the people you meet can save your details and actually follow up, with one scan.`,
    "I'm letting people in a few at a time so I can listen properly to everyone early on. When your spot is ready, I'll send you an access code.",
    "In the meantime, I'd love to know where you usually meet new people: events, work, church, campus? Just hit reply.",
  ];

  const text = [
    `Hi ${firstName},`,
    ...paragraphs,
    `${FOUNDER}\nFounder, ${APP_NAME}\n${site}`,
  ].join("\n\n");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1c1c1a;font-size:16px;line-height:1.65">
  <p>Hi ${escapeHtml(firstName)},</p>
  ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n  ")}
  <p style="margin-top:28px">${FOUNDER}<br><span style="color:#5c5c57">Founder, ${APP_NAME}</span><br><a href="${site}" style="color:#1f4d3f">${site.replace(/^https?:\/\//, "")}</a></p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: SUPPORT_EMAIL,
        subject: `Thanks for joining the ${APP_NAME} private beta`,
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
