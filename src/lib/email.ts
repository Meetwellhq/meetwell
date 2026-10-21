import "server-only";
import { APP_NAME, getSiteUrl, SUPPORT_EMAIL } from "./config";
import {
  draftReminderEmail,
  incompleteProfileEmail,
  FOUNDER_NAME,
  inviteEmail,
  inviteReminderEmail,
  matchEmail,
  type MatchedMember,
  noScansEmail,
  waitlistEmail,
} from "./founder-emails";

// Personal notes from the founder, sent from a no-reply address. The emails
// ask people to write to SUPPORT_EMAIL, and reply-to points there as well.
const FROM = `${FOUNDER_NAME} from ${APP_NAME} <noreply@meetwell.me>`;

function common(fullName: string | null) {
  const site = getSiteUrl();
  return { fullName, appName: APP_NAME, siteUrl: site, photoUrl: `${site}/founder/rasheed.jpg`, replyEmail: SUPPORT_EMAIL };
}

/**
 * Sends one email through Resend's API. Needs RESEND_API_KEY (server-only).
 * Without it the email is skipped, so local development sends nothing.
 */
async function send(to: string, { subject, text, html }: { subject: string; text: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`RESEND_API_KEY is not set; skipping email "${subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: SUPPORT_EMAIL, subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Email failed", subject, res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Email failed", subject, err);
    return false;
  }
}

/** "Thanks for joining the private beta." */
export function sendWaitlistEmail(to: string, fullName: string, unsubscribeToken: string) {
  return send(to, waitlistEmail({ ...common(fullName), unsubscribeToken }));
}

/** "Your invite is ready", with a link that fills in the personal access code. */
export function sendInviteEmail(to: string, fullName: string | null, code: string) {
  return send(to, inviteEmail({ ...common(fullName), code }));
}

/** One-time reminders, sent by the daily job. */
export function sendInviteReminderEmail(to: string, fullName: string | null, code: string) {
  return send(to, inviteReminderEmail({ ...common(fullName), code }));
}
export function sendDraftReminderEmail(to: string, fullName: string | null) {
  return send(to, draftReminderEmail(common(fullName)));
}
export function sendNoScansEmail(to: string, fullName: string | null) {
  return send(to, noScansEmail(common(fullName)));
}

/** AI Network Matching: one recommendation email. */
export function sendMatchEmail(to: string, fullName: string | null, match: MatchedMember, reason: string) {
  return send(to, matchEmail({ ...common(fullName), match, reason }));
}

/** Profile under 80%: finish it (and add a photo) to get matches. Sent once. */
export function sendIncompleteProfileEmail(to: string, fullName: string | null, completeness: number, hasPhoto: boolean) {
  return send(to, incompleteProfileEmail({ ...common(fullName), completeness, hasPhoto }));
}
