/** The outreach message the founder sends by hand on X, filled in for one person. */
export function outreachMessage(firstName: string, link: string) {
  return [
    `Hi ${firstName.trim()},`,
    "",
    "I'm building Meetwell, a networking card you share with a QR code. It also lets experienced people get paid for their time and advice (you set your price and keep 80%).",
    "",
    `I'm looking for people with 4+ years in tech to try it and give me honest feedback. Here's your personal invite: ${link}`,
    "",
    "Would love to hear what you think.",
    "",
    "Rasheed",
  ].join("\n");
}

/** The personal sign-up link for an access code. */
export function inviteLink(siteUrl: string, code: string) {
  return `${siteUrl}/access-code?code=${encodeURIComponent(code)}`;
}

/** "@Dan", "dan", "x.com/dan" or "https://twitter.com/dan?s=20" all become "dan". */
export function xHandle(raw: string) {
  const m = raw.trim().match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})(?:[/?#].*)?$/i);
  const handle = (m ? m[1] : raw.trim().replace(/^@/, "")).toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}
