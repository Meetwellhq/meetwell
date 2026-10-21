import "server-only";
import { APP_NAME, getSiteUrl, SUPPORT_EMAIL } from "./config";
import { fieldLabel } from "./matching/constants";
import {
  draftReminderEmail,
  incompleteProfileEmail,
  FOUNDER_NAME,
  inviteEmail,
  inviteReminderEmail,
  matchEmail,
  mentorApprovedEmail,
  newMessageEmail,
  type MatchedMember,
  noScansEmail,
  renewalReminderEmail,
  sparkBetaEmail,
  waitlistEmail,
  withdrawalSentEmail,
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

/** Spark (AI matching): one recommendation email. */
export function sendMatchEmail(to: string, fullName: string | null, match: MatchedMember, reason: string) {
  return send(to, matchEmail({ ...common(fullName), match, reason }));
}

/** Profile under 80%: finish it (and add a photo) to get matches. Sent once. */
export function sendIncompleteProfileEmail(
  to: string,
  fullName: string | null,
  details: { completeness: number; hasPhoto: boolean; experienceYears: number | null; field: string | null },
) {
  return send(
    to,
    incompleteProfileEmail({ ...common(fullName), ...details, fieldName: fieldLabel(details.field) }),
  );
}

/** One-off announcement: Spark is a new beta feature, come and try it. */
export function sendSparkBetaEmail(to: string, fullName: string | null) {
  return send(to, sparkBetaEmail(common(fullName)));
}

/** LinkedIn-style alert for the first message someone sends in a conversation (the database decides). */
export function sendNewMessageEmail(
  to: string,
  fullName: string | null,
  details: {
    senderName: string;
    senderTitle: string | null;
    senderAvatar: string | null;
    preview: string;
    conversationId: number;
    offToken: string;
  },
) {
  // Names go into the subject line, so keep them on one line.
  const senderName = details.senderName.replace(/s+/g, " ").trim().slice(0, 80) || "A Meetwell member";
  return send(to, newMessageEmail({ ...common(fullName), ...details, senderName }));
}

/** Approved as a mentor. */
export function sendMentorApprovedEmail(to: string, fullName: string | null) {
  return send(to, mentorApprovedEmail(common(fullName)));
}

/** A withdrawal was sent to the mentor's bank. */
export function sendWithdrawalSentEmail(to: string, fullName: string | null, details: { amount: string; bank: string }) {
  return send(to, withdrawalSentEmail({ ...common(fullName), ...details }));
}

/** A member's 30 days with a mentor end soon. */
export function sendRenewalReminderEmail(
  to: string,
  fullName: string | null,
  details: { mentorName: string; mentorSlug: string; endsOn: string },
) {
  return send(to, renewalReminderEmail({ ...common(fullName), ...details }));
}
