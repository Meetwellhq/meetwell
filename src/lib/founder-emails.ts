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
function founderLayout({ firstName, bodyHtml, appName, siteUrl, photoUrl, footerHtml }: {
  firstName: string;
  bodyHtml: string;
  appName: string;
  siteUrl: string;
  photoUrl: string;
  /** Small print under the sign-off, e.g. an unsubscribe line (already HTML). */
  footerHtml?: string;
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
  </table>${footerHtml ? `
  <p style="margin-top:28px;color:#5c5c57;font-size:13px;line-height:1.5">${footerHtml}</p>` : ""}
</div>`;
}

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;

/** Link to turn off occasional waiting-list updates (invites still go out). */
export const unsubscribeUrl = (siteUrl: string, token: string) => `${siteUrl}/unsubscribe?t=${encodeURIComponent(token)}`;

export function waitlistEmail({
  fullName,
  appName,
  siteUrl,
  photoUrl,
  replyEmail,
  unsubscribeToken,
}: Common & { unsubscribeToken: string }) {
  const firstName = firstNameOf(fullName);
  const paragraphs = [
    `I'm so happy to have you here, and thank you for joining the ${appName} private beta.`,
    `A little about ${appName}: it gives you a networking card with its own QR code. Someone scans it with their phone camera, saves your contact in one tap, and gets a ready-made first message, so following up is easy. No app needed.`,
    `I'm ${FOUNDER_NAME}, the founder. I'm letting people in a few at a time so I can listen properly to everyone early on. When your spot is ready, I'll send you an access code.`,
  ];
  // Built separately so the address can be a link in the HTML version.
  const ask =
    "In the meantime, I'd love to know where you usually meet new people: events, work, church, campus? Drop me a line at";

  const updates = "Now and then I'll also send you short updates, like new members you might want to meet.";
  const unsubscribe = unsubscribeUrl(siteUrl, unsubscribeToken);

  const subject = `Thanks for joining the ${appName} private beta`;
  const text = [
    `Hi ${firstName},`,
    ...paragraphs,
    `${ask} ${replyEmail}.`,
    `${FOUNDER_NAME}\nFounder, ${appName}\n${siteUrl}`,
    `${updates} Don't want them? Unsubscribe: ${unsubscribe}`,
  ].join("\n\n");
  const html = founderLayout({
    firstName,
    appName,
    siteUrl,
    photoUrl,
    bodyHtml: [
      ...paragraphs.map(p),
      `<p>${escapeHtml(ask)} <a href="mailto:${replyEmail}" style="color:#1f4d3f">${replyEmail}</a>.</p>`,
    ].join("\n  "),
    footerHtml: `${escapeHtml(updates)} Don't want them? <a href="${unsubscribe}" style="color:#5c5c57">Unsubscribe</a>.`,
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

/** A green call-to-action button. */
const button = (href: string, label: string) =>
  `<p style="margin:24px 0">
    <a href="${href}" style="display:inline-block;background:#1f4d3f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${label}</a>
  </p>`;

const ONLY_ONCE = "This is the only reminder I'll send about this.";

/** Generic one-off reminder: paragraphs, a button, more paragraphs, then the reply line. */
function reminder({
  fullName, appName, siteUrl, photoUrl, replyEmail,
  subject, before, cta, after,
}: Common & { subject: string; before: string[]; cta: { href: string; label: string }; after: string[] }) {
  const firstName = firstNameOf(fullName);
  const ask = "If anything got in the way, tell me at";
  const text = [
    `Hi ${firstName},`,
    ...before,
    `${cta.label}: ${cta.href}`,
    ...after,
    `${ask} ${replyEmail}.`,
    `${FOUNDER_NAME}\nFounder, ${appName}\n${siteUrl}`,
  ].join("\n\n");
  const html = founderLayout({
    firstName,
    appName,
    siteUrl,
    photoUrl,
    bodyHtml: [
      ...before.map(p),
      button(cta.href, cta.label),
      ...after.map(p),
      `<p>${escapeHtml(ask)} <a href="mailto:${replyEmail}" style="color:#1f4d3f">${replyEmail}</a>.</p>`,
    ].join("\n  "),
  });
  return { subject, text, html };
}

/** Invite sent a few days ago, code still unused. */
export function inviteReminderEmail(args: Common & { code: string }) {
  return reminder({
    ...args,
    subject: `Your ${args.appName} invite is still waiting`,
    before: [
      `A few days ago I sent you an invite to the ${args.appName} private beta, and your spot is still saved for you.`,
      "Tap below to create your account. Your access code is already filled in.",
    ],
    cta: { href: `${args.siteUrl}/access-code?code=${encodeURIComponent(args.code)}`, label: "Create your account" },
    after: [`Your access code: ${args.code}`, ONLY_ONCE],
  });
}

/** Signed up, but the card isn't published yet. */
export function draftReminderEmail(args: Common) {
  return reminder({
    ...args,
    subject: `Need a hand finishing your ${args.appName} card?`,
    before: [
      "You've created your account, but your card isn't published yet.",
      "It only takes a minute: add your name, a photo and one way to reach you, then tap Publish. Your QR code is ready as soon as you do.",
    ],
    cta: { href: `${args.siteUrl}/dashboard/profile`, label: "Finish my card" },
    after: [ONLY_ONCE],
  });
}

/** Card published a week ago but never opened from a QR scan. */
export function noScansEmail(args: Common) {
  return reminder({
    ...args,
    subject: `Have you tried your ${args.appName} QR code yet?`,
    before: [
      "Your card is live. The best way to use it is in person, the next time you meet someone.",
      "A simple trick: save your QR code to your phone's photos, or set it as your lock screen. When someone asks for your number, just show it. They scan it with their camera and save your details in one tap.",
    ],
    cta: { href: `${args.siteUrl}/dashboard/qr`, label: "Open my QR code" },
    after: [ONLY_ONCE],
  });
}

export type MatchedMember = {
  fullName: string;
  title: string | null;
  organization: string | null;
  avatarUrl: string | null;
  /** The member's public card. */
  cardUrl: string;
};

/** AI Network Matching: one recommendation, with the reason and a button to their card. */
export function matchEmail({
  fullName, appName, siteUrl, photoUrl, replyEmail, match, reason,
}: Common & { match: MatchedMember; reason: string }) {
  const firstName = firstNameOf(fullName);
  const matchFirst = firstNameOf(match.fullName);
  const subtitle = [match.title, match.organization].filter(Boolean).join(" · ");
  const matchesUrl = `${siteUrl}/dashboard/matches`;
  const intro = `Here's someone I think you should meet on ${appName}.`;
  const nudge = `If it feels right, save ${matchFirst}'s contact and send a short hello. Their card has a ready-made first message to get you started.`;
  const why = `You're getting this because matching is on. You can turn it off anytime on your Matches page.`;

  const subject = `Your ${appName} match: meet ${match.fullName}`;
  const text = [
    `Hi ${firstName},`,
    intro,
    [match.fullName, subtitle].filter(Boolean).join("\n"),
    reason,
    `Say hello to ${matchFirst}: ${match.cardUrl}`,
    nudge,
    `${FOUNDER_NAME}\nFounder, ${appName}\n${siteUrl}`,
    `${why} ${matchesUrl}`,
  ].join("\n\n");

  // Their profile photo, or their initials in a green circle (like on the card).
  const initials = match.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const avatar = match.avatarUrl
    ? `<img src="${escapeHtml(match.avatarUrl)}" width="80" height="80" alt="${escapeHtml(match.fullName)}" style="display:block;margin:0 auto 12px;width:80px;height:80px;border-radius:50%;object-fit:cover">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;border-collapse:collapse"><tr><td width="80" height="80" align="center" valign="middle" style="width:80px;height:80px;border-radius:50%;background:#ffffff;color:#1f4d3f;font-size:26px;font-weight:600">${escapeHtml(initials)}</td></tr></table>`;
  const card = `<div style="margin:24px 0;padding:28px 24px;background:#e9f2ed;border-radius:12px;text-align:center">
    ${avatar}
    <p style="margin:0;font-size:18px;font-weight:600;color:#1c1c1a">${escapeHtml(match.fullName)}</p>
    ${subtitle ? `<p style="margin:4px 0 0;color:#5c5c57;font-size:15px">${escapeHtml(subtitle)}</p>` : ""}
    <div style="margin:20px 0 0;padding:16px 20px;background:#ffffff;border-radius:10px;text-align:center">
      <p style="margin:0 0 6px;color:#1f4d3f;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase">Why we matched you</p>
      <p style="margin:0;color:#1c1c1a;font-size:15px;line-height:1.6">${escapeHtml(reason)}</p>
    </div>
    <p style="margin:24px 0 0"><a href="${escapeHtml(match.cardUrl)}" style="display:inline-block;background:#1f4d3f;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:8px">Say hello to ${escapeHtml(matchFirst)} &rarr;</a></p>
  </div>`;

  const html = founderLayout({
    firstName,
    appName,
    siteUrl,
    photoUrl,
    bodyHtml: [
      p(intro),
      card,
      p(nudge),
      `<p>Questions or feedback on your matches? Write to me at <a href="mailto:${replyEmail}" style="color:#1f4d3f">${replyEmail}</a>.</p>`,
    ].join("\n  "),
    footerHtml: `${escapeHtml(why)} <a href="${matchesUrl}" style="color:#5c5c57">Matches page</a>.`,
  });
  return { subject, text, html };
}

/** Published card under 80% complete: finish it (and add a photo) to get matches. */
export function incompleteProfileEmail(args: Common & { completeness: number; hasPhoto: boolean }) {
  const photoLine = args.hasPhoto
    ? "A few more details will get you there, and you can see exactly what's missing on your Matches page."
    : "The quickest win is a clear photo of you. People are far more likely to save and message someone they can recognise. Then add the last few details listed on your Matches page.";
  return reminder({
    ...args,
    subject: args.hasPhoto
      ? `Your ${args.appName} profile is ${args.completeness}% done`
      : `Add a photo to your ${args.appName} profile`,
    before: [
      `Your ${args.appName} profile is ${args.completeness}% complete. Once it reaches 80%, you'll start getting AI matches: more experienced people in your field worth meeting, up to one a day.`,
      photoLine,
    ],
    // Photos are uploaded in the card editor; the Matches page lists everything else.
    cta: args.hasPhoto
      ? { href: `${args.siteUrl}/dashboard/matches`, label: "Complete my profile" }
      : { href: `${args.siteUrl}/dashboard/profile`, label: "Add my photo" },
    after: [ONLY_ONCE],
  });
}
