/** The outreach message the founder sends by hand on X, filled in for one person. */
export function outreachMessage(firstName: string | null, link: string) {
  return [
    `Hi ${firstName?.trim() || "there"},`,
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

export type OutreachEntry = { firstName: string | null; handle: string; note: string | null };

const looksLikeHandle = (s: string) => s.startsWith("@") || /(?:x|twitter)\.com\//i.test(s);
const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.slice(0, 40) || null;

/**
 * Reads a pasted list, one person per line. Each line needs an X handle or
 * profile link; anything else is the name (first word kept), and with commas or
 * tabs, the parts after the name are the note. For example:
 *   Daniel @danbuilds
 *   https://x.com/amaka_designs Amaka
 *   Tunde Bello, x.com/tunde_ml, ML engineer at a bank
 *   @kemi_codes
 * Lines without a handle come back in `bad`; repeated handles are kept once.
 */
export function parseOutreachList(text: string): { entries: OutreachEntry[]; bad: string[] } {
  const entries: OutreachEntry[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let handle: string | null = null;
    let name: string | null = null;
    let note: string | null = null;

    const parts = line.split(/[,\t]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const i = parts.findIndex((p) => looksLikeHandle(p) && xHandle(p));
      if (i >= 0) {
        handle = xHandle(parts[i]);
        const rest = parts.filter((_, j) => j !== i);
        name = rest[0] ? firstWord(rest[0]) : null;
        note = rest.slice(1).join(", ").slice(0, 300) || null;
      }
    } else {
      const words = line.split(/\s+/);
      const i = words.findIndex((w) => looksLikeHandle(w) && xHandle(w));
      if (i >= 0) {
        handle = xHandle(words[i]);
        name = firstWord(words.filter((_, j) => j !== i).join(" "));
      } else if (words.length === 1) {
        handle = xHandle(words[0]);
      }
    }

    if (!handle) bad.push(line);
    else if (!seen.has(handle)) {
      seen.add(handle);
      entries.push({ firstName: name, handle, note });
    }
  }
  return { entries, bad };
}
