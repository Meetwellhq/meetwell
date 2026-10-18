/**
 * The "thanks for joining the private beta" email: a personal note from the
 * founder. Pure (no imports) so it can be unit-tested and previewed.
 */

export const FOUNDER_NAME = "Rasheed";

/** The name comes from a public form, so escape it before putting it in HTML. */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function waitlistEmail({
  fullName,
  appName,
  siteUrl,
  photoUrl,
}: {
  fullName: string;
  appName: string;
  siteUrl: string;
  /** Absolute URL of the founder's photo (email clients can't load relative paths). */
  photoUrl: string;
}) {
  const firstName = fullName.trim().split(/\s+/)[0] || "there";
  const siteLabel = siteUrl.replace(/^https?:\/\//, "");

  const paragraphs = [
    `I'm so happy to have you here, and thank you for joining the ${appName} private beta.`,
    `A little about ${appName}: it gives you a networking card with its own QR code. Someone scans it with their phone camera, saves your contact in one tap, and gets a ready-made first message, so following up is easy. No app needed.`,
    `I'm ${FOUNDER_NAME}, the founder. I'm letting people in a few at a time so I can listen properly to everyone early on. When your spot is ready, I'll send you an access code.`,
    "In the meantime, I'd love to know where you usually meet new people: events, work, church, campus? Just hit reply.",
  ];

  const subject = `Thanks for joining the ${appName} private beta`;

  const text = [`Hi ${firstName},`, ...paragraphs, `${FOUNDER_NAME}\nFounder, ${appName}\n${siteUrl}`].join("\n\n");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1c1c1a;font-size:16px;line-height:1.65">
  <p>Hi ${escapeHtml(firstName)},</p>
  ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n  ")}
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

  return { subject, text, html };
}
