/**
 * Speaker cards: a partner uploads a spreadsheet of their speakers and each gets
 * a public card at /s/<slug> without an account (20261218000000_speaker_cards.sql).
 * Pure helpers (reading the sheet, tidying links), unit-tested.
 */

export type SpeakerCardInput = {
  name: string;
  email: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  photo: string | null;
  phone: string | null;
  whatsapp: string | null;
  show_phone: boolean;
  linkedin: string | null;
  x: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
};

/** At most this many in one upload (the database takes 300 per call and 1,000 per event). */
export const MAX_SPEAKER_CARDS = 1000;

/** The columns of the template, in order. */
export const SPEAKER_SHEET_COLUMNS = [
  "Name", "Email", "Job title", "Company", "Phone", "WhatsApp", "Show phone", "LinkedIn", "X", "Instagram", "Facebook",
  "TikTok", "Website", "Photo link", "Bio",
] as const;

export const SPEAKER_SHEET_TEMPLATE = [
  SPEAKER_SHEET_COLUMNS.join(","),
  "Ada Obi,ada@example.com,Head of Product,Acme,+234 801 234 5678,+234 801 234 5678,Yes,linkedin.com/in/adaobi,@adaobi,@adaobi,,,acme.com,,Builds payments products for small businesses.",
].join("\r\n");

type Field = keyof SpeakerCardInput;
const HEADERS: [RegExp, Field][] = [
  [/^(full ?)?name$|^speaker( name)?$/, "name"],
  [/^e-?mail( address)?$/, "email"],
  [/^(job ?)?title$|^role$|^position$|^designation$/, "title"],
  [/^company$|^organi[sz]ation$|^employer$/, "organization"],
  [/^bio$|^about$|^short bio$/, "bio"],
  [/^photo( link| url)?$|^picture$|^headshot( link| url)?$|^image( link| url)?$/, "photo"],
  [/^(phone|mobile)( number)?$/, "phone"],
  [/^whats ?app( number)?$/, "whatsapp"],
  [/^show (phone|number)s?$|^share phone$|^phone public$/, "show_phone"],
  [/^linked ?in$/, "linkedin"],
  [/^x$|^twitter$|^x ?\/ ?twitter$|^twitter ?\/ ?x$/, "x"],
  [/^instagram$|^ig$/, "instagram"],
  [/^facebook$|^fb$/, "facebook"],
  [/^tik ?tok$/, "tiktok"],
  [/^website$|^web$|^site$|^url$/, "website"],
];

const fieldFor = (header: string): Field | null => {
  const h = header.toLowerCase().replace(/[^a-z0-9/ ]/g, "").replace(/\s+/g, " ").trim();
  return HEADERS.find(([re]) => re.test(h))?.[1] ?? null;
};

/** Reads CSV text into rows of cells: commas, semicolons or tabs; "quoted, cells" and line breaks in quotes kept. */
export function readCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const SOCIAL_HOST: Record<"linkedin" | "x" | "instagram" | "facebook" | "tiktok", { host: RegExp; base: string }> = {
  linkedin: { host: /(^|\.)linkedin\.com$/, base: "https://www.linkedin.com/in/" },
  x: { host: /(^|\.)(x|twitter)\.com$/, base: "https://x.com/" },
  instagram: { host: /(^|\.)instagram\.com$/, base: "https://www.instagram.com/" },
  facebook: { host: /(^|\.)(facebook|fb)\.com$/, base: "https://www.facebook.com/" },
  tiktok: { host: /(^|\.)tiktok\.com$/, base: "https://www.tiktok.com/@" },
};

/** "@ada", "ada", "x.com/ada" or "https://twitter.com/ada" → a full https link on that site, or null. */
export function socialUrl(platform: keyof typeof SOCIAL_HOST, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const { host, base } = SOCIAL_HOST[platform];
  if (/^[@]?[A-Za-z0-9._-]{1,60}$/.test(v) && !/\.(com|ng|io|me)$/i.test(v)) return base + v.replace(/^@/, "");
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!host.test(url.hostname.toLowerCase())) return null;
    url.protocol = "https:";
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

/** A website or photo link: adds https:// when missing. Photos must be https. */
export function webUrl(raw: string, httpsOnly = false): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!url.hostname.includes(".")) return null;
    if (httpsOnly) url.protocol = "https:";
    return url.toString().slice(0, httpsOnly ? 500 : 300);
  } catch {
    return null;
  }
}

/** Phone numbers as written, if they look like one (7 to 20 digits, +, spaces, brackets, dashes). */
export const phoneValue = (raw: string) => {
  const v = raw.trim().replace(/[.]/g, " ");
  return /^\+?[0-9 ()-]{7,20}$/.test(v) ? v : null;
};

const yes = (v: string) => /^(y|yes|true|1|show|public)$/i.test(v.trim());
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Reads the speakers' spreadsheet (saved as CSV). The first row must name the
 * columns (the template's, or close: "Full name", "Twitter", "Mobile"…).
 * Returns the cards, plus a plain note for every row or value that was left out.
 */
export function parseSpeakerSheet(text: string): { cards: SpeakerCardInput[]; problems: string[]; missingName: boolean } {
  const rows = readCsv(text.replace(/^﻿/, ""));
  const problems: string[] = [];
  if (rows.length === 0) return { cards: [], problems, missingName: false };
  const fields = rows[0].map(fieldFor);
  if (!fields.includes("name")) return { cards: [], problems, missingName: true };

  const cards: SpeakerCardInput[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((cells, i) => {
    const rowNo = i + 2;
    const get = (f: Field) => cells[fields.indexOf(f)]?.trim() ?? "";
    const name = get("name").replace(/\s+/g, " ").slice(0, 80);
    if (!name) {
      problems.push(`Row ${rowNo}: no name, so it was skipped.`);
      return;
    }
    const card: SpeakerCardInput = {
      name, email: null, title: null, organization: null, bio: null, photo: null, phone: null, whatsapp: null,
      show_phone: yes(get("show_phone")), linkedin: null, x: null, instagram: null, facebook: null, tiktok: null, website: null,
    };
    const email = get("email").toLowerCase();
    if (email) {
      if (EMAIL.test(email) && email.length <= 254) card.email = email;
      else problems.push(`${name}: "${email}" isn't an email address, so they won't get the email about their card.`);
    }
    if (card.email && seen.has(card.email)) {
      problems.push(`${name}: ${card.email} is listed twice, so the second one was skipped.`);
      return;
    }
    if (card.email) seen.add(card.email);
    card.title = get("title").slice(0, 100) || null;
    card.organization = get("organization").slice(0, 100) || null;
    card.bio = get("bio").slice(0, 500) || null;
    for (const f of ["phone", "whatsapp"] as const) {
      const raw = get(f);
      if (!raw) continue;
      card[f] = phoneValue(raw);
      if (!card[f]) problems.push(`${name}: "${raw}" doesn't look like a phone number, so it was left out.`);
    }
    for (const f of ["linkedin", "x", "instagram", "facebook", "tiktok"] as const) {
      const raw = get(f);
      if (!raw) continue;
      card[f] = socialUrl(f, raw);
      const site = { linkedin: "LinkedIn", x: "X", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" }[f];
      if (!card[f]) problems.push(`${name}: "${raw}" isn't a link to their ${site} profile, so it was left out.`);
    }
    const site = get("website");
    if (site) {
      card.website = webUrl(site);
      if (!card.website) problems.push(`${name}: "${site}" isn't a website link, so it was left out.`);
    }
    const photo = get("photo");
    if (photo) {
      card.photo = webUrl(photo, true);
      if (!card.photo) problems.push(`${name}: the photo link "${photo}" doesn't work, so it was left out.`);
    }
    cards.push(card);
  });
  return { cards, problems, missingName: false };
}
