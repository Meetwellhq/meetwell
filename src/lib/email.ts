import "server-only";
import { APP_NAME, getSiteUrl, SUPPORT_EMAIL } from "./config";
import { fieldLabel } from "./matching/constants";
import type { TemplateId } from "./admin/campaigns";
import {
  addPhotoEmail,
  draftReminderEmail,
  finishProfileEmail,
  incompleteProfileEmail,
  FOUNDER_NAME,
  inviteEmail,
  inviteReminderEmail,
  matchEmail,
  messageFromLine,
  mentorApprovedEmail,
  mentoringEmail,
  newMessageEmail,
  type MatchedMember,
  noScansEmail,
  partnerAccessEmail,
  publishCardEmail,
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

type EmailContent = { subject: string; text: string; html: string };
type SendOptions = { from?: string; replyTo?: string | null };

/**
 * Sends one email through Resend's API. Needs RESEND_API_KEY (server-only).
 * Without it the email is skipped, so local development sends nothing.
 * Returns Resend's email id (used to match delivery and click events) or null.
 */
async function deliver(
  to: string,
  { subject, text, html }: EmailContent,
  { from = FROM, replyTo = SUPPORT_EMAIL }: SendOptions = {},
): Promise<{ ok: boolean; id: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`RESEND_API_KEY is not set; skipping email "${subject}"`);
    return { ok: false, id: null };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], ...(replyTo ? { reply_to: replyTo } : {}), subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("Email failed", subject, res.status, await res.text());
      return { ok: false, id: null };
    }
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    return { ok: true, id: typeof body?.id === "string" ? body.id : null };
  } catch (err) {
    console.error("Email failed", subject, err);
    return { ok: false, id: null };
  }
}

async function send(to: string, content: EmailContent, options?: SendOptions) {
  return (await deliver(to, content, options)).ok;
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

/** Someone on a partner's team can now see its page. */
export function sendPartnerAccessEmail(to: string, fullName: string | null, partnerName: string) {
  return send(to, partnerAccessEmail({ ...common(fullName), partnerName }));
}

/** The ready-made emails on the admin New email page. */
const CAMPAIGN_EMAILS = {
  publish_card: publishCardEmail,
  add_photo: addPhotoEmail,
  finish_profile: finishProfileEmail,
  spark_beta: sparkBetaEmail,
  mentoring: mentoringEmail,
} satisfies Record<TemplateId, unknown>;

/** Returns whether it went out, and Resend's id for its delivery and click events. */
export function sendCampaignEmail(template: TemplateId, to: string, fullName: string | null) {
  return deliver(to, CAMPAIGN_EMAILS[template](common(fullName)));
}

/** The email as it will look, for the preview on the New email page. */
export function previewCampaignEmail(template: TemplateId, fullName: string | null) {
  return CAMPAIGN_EMAILS[template](common(fullName));
}

/** One-off announcement to draft cards only: publish your card. */
export function sendPublishCardEmail(to: string, fullName: string | null) {
  return send(to, publishCardEmail(common(fullName)));
}

/** One-off announcement: mentoring is open; add your years, and earn as a mentor with 4+. */
export function sendMentoringEmail(to: string, fullName: string | null) {
  return send(to, mentoringEmail(common(fullName)));
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
  // Names go into the subject and the From line, so keep them on one line.
  const senderName = details.senderName.replace(/\s+/g, " ").trim().slice(0, 80) || "A Meetwell member";
  // From "Ada Obi via Meetwell", like LinkedIn; replies aren't read, so no reply-to.
  return send(to, newMessageEmail({ ...common(fullName), ...details, senderName }), {
    from: messageFromLine(senderName, APP_NAME),
    replyTo: null,
  });
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

/** A day without a reply: "Tunde is waiting for your reply", once per waiting message. */
export function sendReplyReminderEmail(
  to: string,
  fullName: string | null,
  details: {
    senderName: string;
    senderTitle: string | null;
    senderAvatar: string | null;
    preview: string;
    conversationId: number;
    offToken: string;
    toMentor: boolean;
  },
) {
  const senderName = details.senderName.replace(/\s+/g, " ").trim().slice(0, 80) || "A Meetwell member";
  return send(to, newMessageEmail({ ...common(fullName), ...details, senderName, reminder: true }), {
    from: messageFromLine(senderName, APP_NAME),
    replyTo: null,
  });
}
