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

/**
 * The Meetwell logo and name at the top of every email. A PNG at an absolute
 * URL, because Gmail doesn't show SVGs or images attached to the email.
 */
export function emailLogo(siteUrl: string, appName: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr>
      <td style="padding-right:10px;vertical-align:middle">
        <img src="${siteUrl}/email/logo.png" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0">
      </td>
      <td style="vertical-align:middle;font-size:19px;font-weight:700;color:#1f4d3f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${escapeHtml(appName)}</td>
    </tr>
  </table>`;
}

/** Shared layout: logo, greeting, body (already HTML), founder sign-off with photo. */
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
  ${emailLogo(siteUrl, appName)}
  <p style="margin-top:24px">Hi ${escapeHtml(firstName)},</p>
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

/** Spark (AI matching): one recommendation, with the reason and a button to their card. */
export function matchEmail({
  fullName, appName, siteUrl, photoUrl, replyEmail, match, reason,
}: Common & { match: MatchedMember; reason: string }) {
  const firstName = firstNameOf(fullName);
  const matchFirst = firstNameOf(match.fullName);
  const subtitle = [match.title, match.organization].filter(Boolean).join(" · ");
  const matchesUrl = `${siteUrl}/dashboard/matches`;
  const intro = `Here's someone I think you should meet on ${appName}.`;
  const nudge = `If it feels right, save ${matchFirst}'s contact and send a short hello. Their card has a ready-made first message to get you started.`;
  const why = `You're getting this because Spark is on. You can turn it off anytime on your Spark page.`;

  const subject = `Spark: meet ${match.fullName}`;
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
      `<p>Questions or feedback on Spark? Write to me at <a href="mailto:${replyEmail}" style="color:#1f4d3f">${replyEmail}</a>.</p>`,
    ].join("\n  "),
    footerHtml: `You're getting this because Spark is on. You can turn it off anytime on your <a href="${matchesUrl}" style="color:#5c5c57">Spark page</a>.`,
  });
  return { subject, text, html };
}

/** Members with this many years can be recommended to others (see the matching SQL). */
export const RECOMMENDABLE_MIN_YEARS = 4;

/**
 * Published card under 80% complete. Without a photo, the copy depends on
 * experience: 4+ years hear why people will want to learn from them; everyone
 * else hears that a photo is the first step to getting Spark introductions.
 */
export function incompleteProfileEmail(
  args: Common & { completeness: number; hasPhoto: boolean; experienceYears: number | null; fieldName: string | null },
) {
  const { appName, siteUrl, completeness, hasPhoto, experienceYears, fieldName } = args;
  const progress = `Your ${appName} profile is ${completeness}% complete.`;
  const finish = "Then add the last few details listed on your Spark page.";

  // Photos are uploaded in the card editor; the Spark page lists everything else.
  if (hasPhoto) {
    return reminder({
      ...args,
      subject: `Your ${appName} profile is ${completeness}% done`,
      before: [
        experienceYears !== null && experienceYears >= RECOMMENDABLE_MIN_YEARS
          ? `${progress} Once it reaches 80%, Spark can start introducing you to people earlier in their careers who want to learn from you.`
          : `${progress} Once it reaches 80%, you'll start getting Spark introductions: more experienced people in your field worth meeting, up to 5 a month.`,
        "A few more details will get you there, and you can see exactly what's missing on your Spark page.",
      ],
      cta: { href: `${siteUrl}/dashboard/matches`, label: "Complete my profile" },
      after: [ONLY_ONCE],
    });
  }

  if (experienceYears !== null && experienceYears >= RECOMMENDABLE_MIN_YEARS) {
    const inField = fieldName ? ` in ${fieldName.toLowerCase()}` : "";
    return reminder({
      ...args,
      subject: "People want to learn from you. Add your photo",
      before: [
        `With ${experienceYears} years${inField}, you're exactly the kind of person people earlier in their careers want to meet and learn from. Our Spark feature introduces experienced members like you to them every day.`,
        `A clear photo makes all the difference: people are far more likely to save your contact and reach out when they can see who they're meeting. ${progress} Add your photo and finish your profile to start being recommended.`,
      ],
      cta: { href: `${siteUrl}/dashboard/profile`, label: "Add my photo" },
      after: [finish, ONLY_ONCE],
    });
  }

  return reminder({
    ...args,
    subject: "Add a photo to get Spark introductions",
    before: [
      `${progress} Once it reaches 80%, Spark will start recommending experienced people in your field for you to meet and learn from, up to 5 a month.`,
      "The best first step is a clear photo of you. Experienced members are far more likely to reply when they can see who's reaching out.",
    ],
    cta: { href: `${siteUrl}/dashboard/profile`, label: "Add my photo" },
    after: [finish, ONLY_ONCE],
  });
}

/** One-off note to every member: Spark is a new beta feature, come and try it. */
export function sparkBetaEmail({ fullName, appName, siteUrl, photoUrl, replyEmail }: Common) {
  const firstName = firstNameOf(fullName);
  const link = `${siteUrl}/dashboard/matches`;
  const before = [
    `I've just opened a new beta feature on ${appName} called Spark, and you're welcome to come and try it. It's free.`,
    "Spark introduces you to someone a step ahead of you: a member with 4+ years of experience in your field, or one close to it. Each introduction comes with a short note on why you two should talk, and a button to open their card and say hello.",
    "To try it, open Spark in your dashboard, switch it on and tell us a little about your work. Only Spark sees these answers. They never show on your card. Once your profile is 80% complete, you'll get up to 5 free introductions a month, by email and on your Spark page.",
  ];
  const after = [
    "Been at it for 4 years or more? Turn Spark on and add a profile photo, and people earlier in their careers can be introduced to you.",
  ];
  const ask = "It's still in beta, so I'd love to hear what works and what doesn't. Write to me at";
  const smallPrint = `This is a one-off note about a new feature, sent because you have a ${appName} account.`;

  const subject = "Come and try Spark, our new beta feature";
  const text = [
    `Hi ${firstName},`,
    ...before,
    `Try Spark: ${link}`,
    ...after,
    `${ask} ${replyEmail}.`,
    `${FOUNDER_NAME}\nFounder, ${appName}\n${siteUrl}`,
    smallPrint,
  ].join("\n\n");
  const html = founderLayout({
    firstName,
    appName,
    siteUrl,
    photoUrl,
    bodyHtml: [
      ...before.map(p),
      button(link, "Try Spark"),
      ...after.map(p),
      `<p>${escapeHtml(ask)} <a href="mailto:${replyEmail}" style="color:#1f4d3f">${replyEmail}</a>.</p>`,
    ].join("\n  "),
    footerHtml: escapeHtml(smallPrint),
  });
  return { subject, text, html };
}

/** Link that turns off message email alerts (no login needed). */
export const messageEmailsOffUrl = (siteUrl: string, token: string) =>
  `${siteUrl}/unsubscribe/messages?t=${encodeURIComponent(token)}`;

function initialsOf(name: string) {
  // Only words that start with a letter, so stray symbols don't become initials.
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * LinkedIn-style message alert, sent only for the first message someone sends
 * in a conversation: the sender's photo, name and title, a short preview of the
 * message, and a Reply button.
 */
export function newMessageEmail({
  fullName, appName, siteUrl, senderName, senderTitle, senderAvatar, preview, conversationId, offToken,
  reminder = false, toMentor = false,
}: Common & {
  senderName: string;
  senderTitle: string | null;
  senderAvatar: string | null;
  preview: string;
  conversationId: number;
  offToken: string;
  /** A day has passed without a reply: "Tunde is waiting for your reply." */
  reminder?: boolean;
  /** The reminder goes to a mentor, who has 7 days to reply before a refund. */
  toMentor?: boolean;
}) {
  const firstName = firstNameOf(fullName);
  const link = `${siteUrl}/dashboard/messages/${conversationId}`;
  const off = messageEmailsOffUrl(siteUrl, offToken);
  const why = "You're receiving this because message emails are on.";
  const senderFirst = senderName.split(" ")[0] || senderName;
  const headline = reminder ? `Hi ${firstName}, ${senderFirst} is waiting for your reply.` : `Hi ${firstName}, you have a new message.`;
  const mentorNote = reminder && toMentor ? "Members who don't get a reply within 7 days of paying get a full refund." : null;

  const subject = reminder ? `${senderFirst} is waiting for your reply` : `${senderName} sent you a message`;
  const text = [
    `Hi ${firstName},`,
    reminder ? `${senderFirst} is waiting for your reply on ${appName}.` : `${senderName} sent you a message on ${appName}.`,
    ...(mentorNote ? [mentorNote] : []),
    `${senderName}${senderTitle ? `\n${senderTitle}` : ""}\n"${preview}"`,
    `Reply: ${link}`,
    why,
    `Turn off message emails: ${off}`,
  ].join("\n\n");

  const avatar = senderAvatar
    ? `<img src="${escapeHtml(senderAvatar)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:50%;object-fit:cover">`
    : `<div style="width:56px;height:56px;border-radius:50%;background:#e8f0ec;color:#1f4d3f;font-weight:600;font-size:20px;line-height:56px;text-align:center">${escapeHtml(initialsOf(senderName))}</div>`;

  const html = `<div style="background:#f6f6f4;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1a">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>
  <div style="max-width:520px;margin:0 auto">
    <div style="margin:0 0 16px">${emailLogo(siteUrl, appName)}</div>
    <div style="background:#ffffff;border:1px solid #e6e5e1;border-radius:12px;padding:24px">
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escapeHtml(headline)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
        <tr>
          <td style="width:56px;vertical-align:top;padding-right:14px">${avatar}</td>
          <td style="vertical-align:top">
            <p style="margin:0;font-size:16px;font-weight:600">${escapeHtml(senderName)}</p>
            ${senderTitle ? `<p style="margin:2px 0 0;font-size:14px;color:#5c5c57">${escapeHtml(senderTitle)}</p>` : ""}
            <div style="margin-top:12px;background:#f3f2ef;border-radius:4px 14px 14px 14px;padding:12px 14px;font-size:15px;line-height:1.55;white-space:pre-wrap">${escapeHtml(preview)}</div>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0">
        <a href="${link}" style="display:inline-block;background:#1f4d3f;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 24px;border-radius:8px">Reply</a>
        <a href="${link}" style="display:inline-block;margin-left:12px;color:#1f4d3f;text-decoration:none;font-weight:600;padding:11px 4px">View conversation</a>
      </p>${mentorNote ? `
      <p style="margin:16px 0 0;font-size:14px;color:#5c5c57">${escapeHtml(mentorNote)}</p>` : ""}
    </div>
    <p style="margin:16px 4px 0;font-size:12px;line-height:1.5;color:#7a7a74">${escapeHtml(why)} <a href="${off}" style="color:#7a7a74">Turn off message emails</a>.</p>
  </div>
</div>`;
  return { subject, text, html };
}

/** Short note from the founder: paragraphs, one button, the reply line. */
function note({
  fullName, appName, siteUrl, photoUrl, replyEmail, subject, before, cta, after = [],
}: Common & { subject: string; before: string[]; cta: { href: string; label: string }; after?: string[] }) {
  const firstName = firstNameOf(fullName);
  const ask = "Questions? Write to me at";
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

/** Approved as a mentor: set a price and start taking messages. */
export function mentorApprovedEmail(args: Common) {
  return note({
    ...args,
    subject: `You're a ${args.appName} mentor now`,
    before: [
      `Good news: you're approved as a mentor on ${args.appName}.`,
      "Members earlier in their careers can now pay a monthly fee to message you. You choose the price, and 80% of every payment goes into your wallet, ready to withdraw 7 days later.",
      "Set your price and switch on messages to get started.",
    ],
    cta: { href: `${args.siteUrl}/dashboard/mentor`, label: "Set up mentoring" },
    after: ["Please reply to new members within 7 days. If you don't, they get a full refund."],
  });
}

/** A withdrawal was approved and sent to the mentor's bank. */
export function withdrawalSentEmail(args: Common & { amount: string; bank: string }) {
  return note({
    ...args,
    subject: `${args.amount} is on its way to you`,
    before: [
      `Your withdrawal of ${args.amount} has been sent to your ${args.bank} account. It usually arrives within a few hours.`,
    ],
    cta: { href: `${args.siteUrl}/dashboard/mentor`, label: "View your wallet" },
  });
}

/** A member's 30 days with a mentor end in about 3 days. */
export function renewalReminderEmail(args: Common & { mentorName: string; mentorSlug: string; endsOn: string }) {
  const first = args.mentorName.split(" ")[0] || args.mentorName;
  return note({
    ...args,
    subject: `Your messages with ${first} end on ${args.endsOn}`,
    before: [
      `Your 30 days of messages with ${args.mentorName} end on ${args.endsOn}.`,
      "If you'd like to keep talking, you can renew for another 30 days. Your conversation stays where it is.",
    ],
    cta: { href: `${args.siteUrl}/subscribe/${encodeURIComponent(args.mentorSlug)}`, label: `Keep talking to ${first}` },
    after: ["Nothing renews on its own, so you won't be charged unless you choose to."],
  });
}

/**
 * The From line for message emails: "Ada Obi via Meetwell" <messages-noreply@meetwell.me>.
 * One line, and no quotes or angle brackets, which would break the header.
 */
export function messageFromLine(senderName: string, appName: string) {
  const name = senderName.replace(/\s+/g, " ").replace(/["<>\\]/g, "").trim().slice(0, 80) || `A ${appName} member`;
  return `"${name} via ${appName}" <messages-noreply@meetwell.me>`;
}
