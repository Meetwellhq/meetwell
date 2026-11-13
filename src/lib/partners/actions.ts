"use server";

import { revalidatePath } from "next/cache";
import { sendEventSpeakerEmail, sendSpeakerCardEmails, sendSpeakerInviteEmails, type SpeakerCardRow, type SpeakerInviteRow } from "../email";
import { eventDates, linkName } from "../events";
import { isDrivePhoto, MAX_SPEAKER_CARDS, type SpeakerCardInput } from "../speaker-cards";
import { copyDrivePhoto } from "../speaker-photos";
import { inviteSummary, MAX_SPEAKER_INVITES, parseSpeakerList, type InviteOutcome } from "../speaker-invites";
import { createClient, getCurrentUser } from "../supabase/server";

/**
 * Event pages for a partner's own team, from the Partner tab: create, edit and
 * add or remove speakers. The database checks they're on the partner's team
 * (20261210000000_partner_manage_events.sql). Deleting and hiding stay in admin.
 */

export type PartnerFormState = { ok?: string; error?: string };

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Name, dates, venue and description from an event form, or what's wrong with them. */
function eventFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "") || null;
  if (!name) return { error: "Add the event's name." };
  if (!isDate(startsOn)) return { error: "Pick the date it starts." };
  if (endsOn && (!isDate(endsOn) || endsOn < startsOn)) return { error: "The end date can't be before the start." };
  return {
    fields: {
      p_name: name,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
      p_venue: String(formData.get("venue") ?? "").trim().slice(0, 120) || null,
      p_about: String(formData.get("about") ?? "").trim().slice(0, 600) || null,
    },
  };
}

const refresh = (eventSlug?: string) => {
  revalidatePath("/dashboard/partner");
  revalidatePath("/admin", "layout");
  if (eventSlug) revalidatePath(`/e/${eventSlug}`);
};

/** A new event page for one of my partners. It's live at /e/<slug> straight away. */
export async function partnerCreateEvent(partnerSlug: string, _: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const parsed = eventFields(formData);
  if (!parsed.fields) return { error: parsed.error };
  const slug = linkName(String(formData.get("slug") ?? "") || parsed.fields.p_name);
  if (slug.length < 3) return { error: "The link name needs at least 3 letters or numbers." };

  const { error } = await (await createClient()).rpc("partner_create_event", { p_partner_slug: partnerSlug, p_slug: slug, ...parsed.fields });
  if (error) {
    if (error.code === "23505") return { error: `The link name "${slug}" is taken. Try another.` };
    console.error("partner_create_event failed", error.code, error.message);
    return { error: error.code === "42501" ? "You can't add events for this partner." : "Couldn't add the event." };
  }
  refresh(slug);
  return { ok: `Added ${parsed.fields.p_name}. Now add its speakers.` };
}

/** Edit an event's details. Its link (and printed QR codes) stays the same. */
export async function partnerUpdateEvent(eventSlug: string, _: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const parsed = eventFields(formData);
  if (!parsed.fields) return { error: parsed.error };
  const { error } = await (await createClient()).rpc("partner_update_event", { p_event_slug: eventSlug, ...parsed.fields });
  if (error) {
    console.error("partner_update_event failed", error.code, error.message);
    return { error: error.code === "42501" ? "You can't edit this event." : "Couldn't save the changes." };
  }
  refresh(eventSlug);
  return { ok: "Saved." };
}

type SpeakerAdded = { full_name: string; profile_slug: string; card_status: string; added: boolean };
type SpeakerEmail = {
  email: string;
  full_name: string | null;
  card_status: string;
  event_name: string;
  starts_on: string;
  ends_on: string | null;
  venue: string | null;
  partner_name: string;
};

/** Add a speaker by their account email or card link, and email them about it (once per event). */
export async function partnerAddEventSpeaker(eventSlug: string, _: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const who = String(formData.get("who") ?? "").trim().slice(0, 200);
  if (!who) return { error: "Enter their email or card link." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_add_event_speaker", { p_event_slug: eventSlug, p_who: who });
  if (error) {
    if (error.message.includes("No card found")) return { error: "No card found for that email or link. They need a Meetwell card first." };
    return { error: error.code === "42501" ? "You can't add speakers to this event." : "Couldn't add them." };
  }
  refresh(eventSlug);
  const s = ((data ?? []) as SpeakerAdded[])[0];
  if (!s) return { ok: "Added." };
  if (!s.added) return { ok: `${s.full_name} is already a speaker.` };
  const emailed = await emailAddedSpeaker(supabase, eventSlug, s.profile_slug);
  if (emailed === null) return { ok: `Added ${s.full_name}.` };
  return { ok: emailed ? `Added ${s.full_name}. We emailed them.` : `Added ${s.full_name}. The email didn't send, so let them know.` };
}

/**
 * The "you're a speaker" email to someone just added. Their email address only
 * ever reaches the server, and only the first time: null when it was already sent.
 */
async function emailAddedSpeaker(supabase: Awaited<ReturnType<typeof createClient>>, eventSlug: string, profileSlug: string) {
  const secret = process.env.CRON_SECRET;
  const { data: due } = secret
    ? await supabase.rpc("claim_event_speaker_email", { p_token: secret, p_event_slug: eventSlug, p_profile_slug: profileSlug })
    : { data: null };
  const mail = ((due ?? []) as SpeakerEmail[])[0];
  if (!mail) return null;
  const me = await getCurrentUser();
  return sendEventSpeakerEmail(mail.email, mail.full_name, {
    eventName: mail.event_name,
    eventSlug,
    profileSlug,
    dates: eventDates(mail.starts_on, mail.ends_on),
    venue: mail.venue,
    partnerName: mail.partner_name,
    published: mail.card_status === "published",
  }, me?.email ?? null);
}

type InviteRow = { email: string; full_name: string | null; outcome: InviteOutcome; profile_slug: string | null };
/**
 * Sends the event's waiting invite emails for up to ~40 seconds (Vercel stops a
 * request at 60). What's left goes with the next click or the daily job.
 */
async function sendWaiting(supabase: Awaited<ReturnType<typeof createClient>>, eventSlug: string) {
  const secret = process.env.CRON_SECRET;
  const total = { sent: 0, failed: 0 };
  if (!secret) return { ...total, left: 0 };
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    const { data, error } = await supabase.rpc("claim_speaker_invite_emails", { p_token: secret, p_event_slug: eventSlug, p_limit: 10 });
    if (error) {
      console.error("claim_speaker_invite_emails failed", error.code, error.message);
      break;
    }
    const rows = (data ?? []) as SpeakerInviteRow[];
    if (rows.length === 0) break;
    const r = await sendSpeakerInviteEmails(rows);
    total.sent += r.sent;
    total.failed += r.failed;
  }
  const { data: left } = await supabase.rpc("event_speaker_invites_waiting", { p_event_slug: eventSlug });
  return { ...total, left: typeof left === "number" ? left : 0 };
}

const sendNote = (r: { sent: number; failed: number; left: number }) =>
  [
    r.sent > 0 && `${r.sent} ${r.sent === 1 ? "email" : "emails"} sent`,
    r.failed > 0 && `${r.failed} didn't send (check those addresses)`,
    r.left > 0 && `${r.left} still to send: press "Send the rest"`,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Invite a list of speakers (pasted, or a CSV) to an event. People who already
 * have a card are added straight away and get the "you're a speaker" email;
 * everyone else gets an invite with their own access code. For a partner's team
 * or an admin: the database checks.
 */
export async function inviteEventSpeakers(eventSlug: string, _: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { people, bad } = parseSpeakerList(String(formData.get("list") ?? "").slice(0, 200_000));
  if (people.length === 0) return { error: "Add at least one email address, one person per line." };
  if (people.length > MAX_SPEAKER_INVITES) return { error: `That's ${people.length} people. Send up to ${MAX_SPEAKER_INVITES} at a time.` };

  const supabase = await createClient();
  const rows: InviteRow[] = [];
  for (let i = 0; i < people.length; i += 300) {
    const { data, error } = await supabase.rpc("invite_event_speakers", { p_event_slug: eventSlug, p_people: people.slice(i, i + 300) });
    if (error) {
      console.error("invite_event_speakers failed", error.code, error.message);
      if (error.code === "42501") return { error: "You can't invite speakers to this event." };
      if (error.message.includes("1,000")) return { error: "An event can have up to 1,000 invites." };
      return { error: rows.length ? `Invited the first ${rows.length}, then something went wrong. Try the rest again.` : "Couldn't send the invites." };
    }
    rows.push(...((data ?? []) as InviteRow[]));
  }

  const counts: Partial<Record<InviteOutcome, number>> = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  counts.bad_email = (counts.bad_email ?? 0) + bad.length;
  for (const r of rows) if (r.outcome === "added" && r.profile_slug) await emailAddedSpeaker(supabase, eventSlug, r.profile_slug);

  const sending = await sendWaiting(supabase, eventSlug);
  refresh(eventSlug);
  return { ok: [inviteSummary(counts), sendNote(sending)].filter(Boolean).join(". ") + "." };
}

/** The invite emails a big list didn't get to in one go. */
export async function sendWaitingSpeakerInvites(eventSlug: string): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const supabase = await createClient();
  const { data: waiting, error } = await supabase.rpc("event_speaker_invites_waiting", { p_event_slug: eventSlug });
  if (error) return { error: "You can't send invites for this event." };
  if (!waiting) return { ok: "Every invite has been sent." };
  const r = await sendWaiting(supabase, eventSlug);
  refresh(eventSlug);
  return { ok: sendNote(r) + "." };
}

/** Take back an invite: a typo, or someone who isn't speaking after all. */
export async function cancelSpeakerInvite(eventSlug: string, email: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("cancel_event_speaker_invite", { p_event_slug: eventSlug, p_email: email });
  if (error) return { error: "Couldn't cancel that invite." };
  refresh(eventSlug);
  return {};
}

export async function partnerRemoveEventSpeaker(eventSlug: string, profileSlug: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("partner_remove_event_speaker", { p_event_slug: eventSlug, p_profile_slug: profileSlug });
  if (error) return { error: "Couldn't remove them." };
  refresh(eventSlug);
  return {};
}

type CardRow = { full_name: string | null; email: string | null; slug: string | null; outcome: "created" | "member_added" | "duplicate" | "bad" };

/** Speaker card emails for the event, for up to ~40 seconds. */
async function sendWaitingCards(supabase: Awaited<ReturnType<typeof createClient>>, eventSlug: string) {
  const secret = process.env.CRON_SECRET;
  const total = { sent: 0, failed: 0 };
  if (!secret) return { ...total, left: 0 };
  const until = Date.now() + 40_000;
  while (Date.now() < until) {
    const { data, error } = await supabase.rpc("claim_speaker_card_emails", { p_token: secret, p_event_slug: eventSlug, p_limit: 10 });
    if (error) {
      console.error("claim_speaker_card_emails failed", error.code, error.message);
      break;
    }
    const rows = (data ?? []) as SpeakerCardRow[];
    if (rows.length === 0) break;
    const r = await sendSpeakerCardEmails(rows);
    total.sent += r.sent;
    total.failed += r.failed;
  }
  const { data: left } = await supabase.rpc("speaker_card_emails_waiting", { p_event_slug: eventSlug });
  return { ...total, left: typeof left === "number" ? left : 0 };
}

/**
 * Speaker cards from the partner's spreadsheet, already read in the browser
 * (parseSpeakerSheet) and sent as JSON. The team must confirm the speakers
 * agreed; the database checks that, and that they manage this event.
 */
export async function addSpeakerCards(eventSlug: string, _: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  if (formData.get("consent") !== "yes") return { error: "Tick the box to confirm your speakers agreed to their details being shown." };
  let cards: SpeakerCardInput[];
  try {
    cards = JSON.parse(String(formData.get("cards") ?? "[]"));
  } catch {
    return { error: "Couldn't read the spreadsheet. Try uploading it again." };
  }
  if (!Array.isArray(cards) || cards.length === 0) return { error: "Upload a spreadsheet with at least one speaker." };
  if (cards.length > MAX_SPEAKER_CARDS) return { error: `Up to ${MAX_SPEAKER_CARDS} speakers at a time.` };

  const supabase = await createClient();
  const rows: CardRow[] = [];
  for (let i = 0; i < cards.length; i += 300) {
    const { data, error } = await supabase.rpc("add_speaker_cards", { p_event_slug: eventSlug, p_cards: cards.slice(i, i + 300), p_consent: true });
    if (error) {
      console.error("add_speaker_cards failed", error.code, error.message);
      if (error.code === "42501") return { error: "You can't add speakers to this event." };
      if (error.message.includes("1,000")) return { error: "An event can have up to 1,000 speaker cards." };
      return { error: rows.length ? `Added the first ${rows.length}, then something went wrong. Upload the rest again.` : "Couldn't add the speakers." };
    }
    rows.push(...((data ?? []) as CardRow[]));
  }
  const n = (o: CardRow["outcome"]) => rows.filter((r) => r.outcome === o).length;
  for (const r of rows) if (r.outcome === "member_added" && r.slug) await emailAddedSpeaker(supabase, eventSlug, r.slug);

  // Google Drive photos: copy them into Meetwell (one row came back per card, in order).
  const drive = rows.flatMap((r, i) => (r.outcome === "created" && r.slug && isDrivePhoto(cards[i]?.photo) ? [{ slug: r.slug, url: cards[i].photo! }] : []));
  const photos = await copyPhotos(supabase, eventSlug, drive, 20_000);

  const sending = await sendWaitingCards(supabase, eventSlug);
  refresh(eventSlug);
  const people = (x: number) => `${x} ${x === 1 ? "speaker" : "speakers"}`;
  const summary = [
    n("created") && `Added ${people(n("created"))} to the event page`,
    n("member_added") && `${people(n("member_added"))} already had a Meetwell card and ${n("member_added") === 1 ? "was" : "were"} added with it`,
    n("duplicate") && `${people(n("duplicate"))} already had a card on this event`,
    n("bad") && `${people(n("bad"))} couldn't be added (check their links)`,
  ].filter(Boolean).join(" · ");
  return { ok: [summary, photoNote(photos), sendNote(sending)].filter(Boolean).join(". ") + "." };
}

/** Copies Drive photos for up to `budgetMs`, saving each copy on its card. */
async function copyPhotos(supabase: Awaited<ReturnType<typeof createClient>>, eventSlug: string, items: { slug: string; url: string }[], budgetMs: number) {
  const result = { copied: 0, failed: 0, left: 0 };
  const until = Date.now() + budgetMs;
  for (const [i, item] of items.entries()) {
    if (Date.now() > until) {
      result.left = items.length - i;
      break;
    }
    const url = await copyDrivePhoto(supabase, eventSlug, item.url);
    // Not copied (not shared publicly, not an image…): clear it, so the card shows initials, not a broken picture.
    const { error } = await supabase.rpc("set_speaker_card_photo", { p_event_slug: eventSlug, p_slug: item.slug, p_url: url });
    if (url && !error) result.copied++;
    else result.failed++;
  }
  return result;
}

const photoNote = (r: { copied: number; failed: number; left: number }) =>
  [
    r.copied > 0 && `${r.copied} ${r.copied === 1 ? "photo" : "photos"} copied from Google Drive`,
    r.failed > 0 && `${r.failed} ${r.failed === 1 ? "photo" : "photos"} couldn't be copied from Google Drive, so those speakers show their initials (share the photos with "Anyone with the link" and upload again, or add photo files)`,
    r.left > 0 && `${r.left} more to copy: press "Copy Drive photos"`,
  ]
    .filter(Boolean)
    .join(" · ");

/** The Google Drive photos an upload didn't get to (or couldn't copy), tried again. */
export async function copySpeakerDrivePhotos(eventSlug: string): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("event_speaker_cards_list", { p_event_slug: eventSlug });
  if (error) return { error: "You can't change this event." };
  const items = ((data ?? []) as { slug: string; photo_url: string | null }[])
    .filter((c) => isDrivePhoto(c.photo_url))
    .map((c) => ({ slug: c.slug, url: c.photo_url! }));
  if (items.length === 0) return { ok: "Every photo is already copied." };
  const r = await copyPhotos(supabase, eventSlug, items, 45_000);
  refresh(eventSlug);
  return { ok: photoNote(r) + "." };
}

export async function sendWaitingSpeakerCards(eventSlug: string): Promise<PartnerFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const supabase = await createClient();
  const { data: waiting, error } = await supabase.rpc("speaker_card_emails_waiting", { p_event_slug: eventSlug });
  if (error) return { error: "You can't send emails for this event." };
  if (!waiting) return { ok: "Every speaker has been emailed." };
  const r = await sendWaitingCards(supabase, eventSlug);
  refresh(eventSlug);
  return { ok: sendNote(r) + "." };
}

export async function removeSpeakerCard(eventSlug: string, cardSlug: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("remove_speaker_card", { p_event_slug: eventSlug, p_slug: cardSlug });
  if (error) return { error: "Couldn't remove that card." };
  refresh(eventSlug);
  return {};
}
