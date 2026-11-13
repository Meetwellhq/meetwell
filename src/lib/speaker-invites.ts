/**
 * Speaker invites: a partner's team pastes or uploads a list of names and
 * emails, and Meetwell invites them all to the event at once
 * (20261217000000_event_speaker_invites.sql). Pure helpers, unit-tested.
 */

export type SpeakerToInvite = { name: string | null; email: string };

/** At most this many people in one go (the database takes 300 per call and 1,000 per event). */
export const MAX_SPEAKER_INVITES = 1000;

const EMAIL = /[^\s,;<>"'()]+@[^\s,;<>"'()]+\.[^\s,;<>"'()]+/;

/**
 * Reads a pasted list or a CSV from Excel or Google Sheets, one person per line.
 * Each line needs an email; the first other column is the name. For example:
 *   Ada Obi, ada@example.com
 *   ada@example.com
 *   Ada Obi <ada@example.com>
 *   "Obi, Ada",ada@example.com,CTO at Acme   (extra columns are ignored)
 * A header row ("Name, Email") is skipped. Lines without an email come back in
 * `bad`; an email listed twice is kept once.
 */
export function parseSpeakerList(text: string): { people: SpeakerToInvite[]; bad: string[] } {
  const people: SpeakerToInvite[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(EMAIL);
    if (!match) {
      if (!isHeader(line)) bad.push(line);
      continue;
    }
    const email = match[0].toLowerCase().replace(/[.]+$/, "");
    if (seen.has(email)) continue;
    seen.add(email);

    const rest = line.replace(match[0], "\u0000");
    const parts = splitColumns(rest).filter((p) => p && !p.includes("\u0000"));
    const before = rest.split("\u0000")[0].replace(/[<"'(\s,;\t]+$/, "").trim();
    // "Ada Obi <ada@x.com>" or "Ada Obi ada@x.com": the words before the email; else the first other column.
    const name = (/[,;\t]/.test(rest) ? parts[0] : before) ?? null;
    people.push({ name: name ? name.replace(/\s+/g, " ").slice(0, 80) : null, email });
  }
  return { people, bad };
}

/** "Name, Email" and the like: a spreadsheet's header row. */
const HEADER_CELL = /^(full ?name|first ?name|last ?name|surname|name|e-?mail( address)?|title|job title|role|company|organi[sz]ation|phone( number)?)$/i;
const isHeader = (line: string) => splitColumns(line).every((c) => HEADER_CELL.test(c));

/** Splits one CSV line into trimmed cells, keeping "quoted, cells" together. */
function splitColumns(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "," || ch === ";" || ch === "\t")) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells.map((c) => c.replace(/^["']|["']$/g, "").trim());
}

export type InviteStatus = "waiting" | "invited" | "signed_up" | "joined";
export type SpeakerInvite = { email: string; full_name: string | null; status: InviteStatus; emailed_at: string | null };

export const INVITE_STATUS: Record<InviteStatus, { label: string; tone: "neutral" | "accent" | "warning" | "success" }> = {
  waiting: { label: "Email waiting", tone: "warning" },
  invited: { label: "Invited", tone: "neutral" },
  signed_up: { label: "No card yet", tone: "accent" },
  joined: { label: "Joined", tone: "success" },
};

export type InviteOutcome = "added" | "already_speaker" | "invited" | "already_invited" | "no_card" | "bad_email";

/** "Invited 35 · Added 3 who already had a card · 2 were already invited". */
export function inviteSummary(counts: Partial<Record<InviteOutcome, number>>) {
  const n = (k: InviteOutcome) => counts[k] ?? 0;
  const people = (x: number) => `${x} ${x === 1 ? "person" : "people"}`;
  return [
    n("invited") && `Invited ${people(n("invited"))}`,
    n("added") && `added ${people(n("added"))} who already had a card`,
    n("no_card") && `${people(n("no_card"))} already had an account and will join when they make their card`,
    n("already_invited") + n("already_speaker") && `${people(n("already_invited") + n("already_speaker"))} were already on the list`,
    n("bad_email") && `${people(n("bad_email"))} had an email that doesn't look right`,
  ]
    .filter(Boolean)
    .join(" · ")
    .replace(/^./, (c) => c.toUpperCase());
}
