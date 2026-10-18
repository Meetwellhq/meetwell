/**
 * Personal emails from the founder: the waiting-list welcome and the beta
 * invite. Pure (no imports) so they can be unit-tested and previewed.
 */

export const FOUNDER_NAME = "Rasheed";

type Common = {
  fullName: string | null;
  appName: string;
  siteUrl: string;
  /** Absolute URL of the founder's photo (email clients can't load relative paths). */
  photoUrl: string;
  /** Where people should write back; the emails come from a no-reply address. */
  replyEmail: string;
};

/** Names come from a public form, so escape them before putting them in HTML. */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function firstNameOf(fullName: string | null) {
  return fullName?.trim().split(/\s+/)[0] || "there";
}

/** Shared layout: greeting, body (already HTML), founder sign-off with photo. */
function founderLayout({ firstName, bodyHtml, appName, siteUrl, photoUrl }: {
  firstName: string;
  bodyHtml: string;
  appName: string;
  siteUrl: string;
  photoUrl: string;
}) {
  const siteLabel = siteUrl.replace(/^https?:\/\//, "");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1c1c1a;font-size:16px;line-height:1.65">
  <p>Hi ${escapeHtml(firstName)},</p>
  ${bodyHtml}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:collapse">
    <tr>
      <td style="padding-right:14px;vertical-align:middle">
        <img src="${photoUrl}" width="56" height="56" alt="${FOUNDER_NAME}" style="display:block;width:56px;height:56px;border-radius:50%">
      </td>
      <td style="vertical-align:middle;font-size:15px;line-height:1.45">
        <strong>${FOUNDER_NAME}</strong><br>
        <span style="color:#5c5c57">Founder, ${appName}</span><br>
        <a href="${siteUrl}" style="color:#1f4d3f">${siteLabel}</a>
      </td>
    </tr>
  </table>
</div>`;
}

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;

export function waitlistEmail({ fullName, appName, siteUrl, photoUrl, replyEmail }: Common) {
  const firstName = firstNameOf(fullName);
  const paragraphs = [
    `I'm so happy to have you here, and thank you for joining the ${appName} private beta.`,
    `A little about ${appName}: it gives you a networking card with its own QR code. Someone scans it with their phone camera, saves your contact in one tap, and gets a ready-made first message, so following up is easy. No app needed.`,
    `I'm ${FOUNDER_NAME}, the founder. I'm letting people in a few at a time so I can listen properly to everyone early on. When your spot is ready, I'll send you an access code.`,
  ];
  // Built separately so the address can be a link in the HTML version.
  const ask =
    "In the meantime, I'd love to know where you usually meet new people: events, work, church, campus? Drop me a line at";

  const subject = `Thanks for joining the ${appName} private beta`;
  const text = [`Hi ${firstName},`, ...paragraphs, `${ask} ${replyEmail}.`, `${FOUNDER_NAME}\nFounder, ${appName}\n${siteUrl}`].join("\n\n");
  const html = founderLayout({
    firstName,
    appName,
    siteUrl,
    photoUrl,
    bodyHtml: [
      ...paragraphs.map(p),
      `<p>${escapeHtml(ask)} <a href="mailto:${replyEmail}" style="color:#1f4d3f">${replyEmail}</a>.</p>`,
    ].join("\n  "),
  });
  return { subject, text, html };
}

export function inviteEmail({ fullName, appName, siteUrl, photoUrl, replyEmail, code }: Common & { code: string }) {
  const firstName = firstNameOf(fullName);
  const link = `${siteUrl}/access-code?code=${encodeURIComponent(code)}`;
  const before = [
    `Good news: your spot in the ${appName} private beta is ready.`,
    "Tap the button below to create your account. Your personal access code is already filled in.",
  ];
  const after = [
    "It takes about two minutes to set up your card. Then show your QR code to the next person you meet.",
    "The code works once and is valid for 30 days.",
  ];
  const ask = "If anything feels confusing or broken, tell me at";

  const subject = `Your ${appName} invite is ready`;
  const text = [
    `Hi ${firstName},`,
    ...before,
    `Create your account: ${link}`,
    `Your access code: ${code}`,
    ...after,
    `${ask} ${replyEmail}.`,
    `${FOUNDER_NAME}\nFounder, ${appName}\n${siteUrl}`,
  ].join("\n\n");

  const button = `<p style="margin:24px 0">
    <a href="${link}" style="display:inline-block;background:#1f4d3f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">Create your account</a>
  </p>
  <p style="color:#5c5c57;font-size:14px">Your access code: <strong style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#1c1c1a;letter-spacing:0.04em">${escapeHtml(code)}</strong></p>`;

  const html = founderLayout({
    firstName,
    appName,
    siteUrl,
    photoUrl,
    bodyHtml: [
      ...before.map(p),
      button,
      ...after.map(p),
      `<p>${escapeHtml(ask)} <a href="mailto:${replyEmail}" style="color:#1f4d3f">${replyEmail}</a>.</p>`,
    ].join("\n  "),
  });
  return { subject, text, html };
}
