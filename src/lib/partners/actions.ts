"use server";

import { revalidatePath } from "next/cache";
import { sendEventSpeakerEmail } from "../email";
import { eventDates, linkName } from "../events";
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

  // Their email address only ever reaches the server, and only the first time.
  const secret = process.env.CRON_SECRET;
  const { data: due } = secret
    ? await supabase.rpc("claim_event_speaker_email", { p_token: secret, p_event_slug: eventSlug, p_profile_slug: s.profile_slug })
    : { data: null };
  const mail = ((due ?? []) as SpeakerEmail[])[0];
  if (!mail) return { ok: `Added ${s.full_name}.` };
  const emailed = await sendEventSpeakerEmail(mail.email, mail.full_name, {
    eventName: mail.event_name,
    eventSlug,
    profileSlug: s.profile_slug,
    dates: eventDates(mail.starts_on, mail.ends_on),
    venue: mail.venue,
    partnerName: mail.partner_name,
    published: mail.card_status === "published",
  });
  return { ok: emailed ? `Added ${s.full_name}. We emailed them.` : `Added ${s.full_name}. The email didn't send, so let them know.` };
}

export async function partnerRemoveEventSpeaker(eventSlug: string, profileSlug: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("partner_remove_event_speaker", { p_event_slug: eventSlug, p_profile_slug: profileSlug });
  if (error) return { error: "Couldn't remove them." };
  refresh(eventSlug);
  return {};
}
