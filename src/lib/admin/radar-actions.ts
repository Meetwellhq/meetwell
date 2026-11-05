"use server";

import { revalidatePath } from "next/cache";
import { RADAR_CATEGORIES, RADAR_STAGES, type RadarStatus } from "../radar";
import { createClient, getCurrentUser } from "../supabase/server";

/** Partner radar actions. The database refuses anyone who isn't an admin. */

type Result = { error?: string };
export type RadarFormState = { ok?: string; error?: string };

const done = () => revalidatePath("/admin/radar");

export async function radarSetStatus(id: string, status: RadarStatus): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  if (!RADAR_STAGES.some((s) => s.value === status)) return { error: "That isn't a stage." };
  const { error } = await (await createClient()).rpc("admin_set_radar_status", { p_id: id, p_status: status });
  if (error) return { error: "Couldn't update that." };
  done();
  return {};
}

export async function radarSetDetails(id: string, notes: string, contact: string): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_radar_details", {
    p_id: id,
    p_notes: notes.slice(0, 4000),
    p_contact: contact.slice(0, 200),
  });
  if (error) return { error: "Couldn't save that." };
  done();
  return {};
}

export async function radarMarkFollowedUp(id: string): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_mark_radar_followed_up", { p_id: id });
  if (error) return { error: "Couldn't save that." };
  done();
  return {};
}

export async function radarDelete(id: string): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_delete_radar_event", { p_id: id });
  if (error) return { error: "Couldn't remove it." };
  done();
  return {};
}

export async function radarSetPitch(pitch: string, offer: string, sender: string): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_radar_pitch", {
    p_pitch: pitch.slice(0, 2000),
    p_offer: offer.slice(0, 2000),
    p_sender: sender.slice(0, 200),
  });
  if (error) return { error: "Couldn't save your pitch." };
  done();
  return {};
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Add an event by hand. */
export async function radarAdd(_: RadarFormState, formData: FormData): Promise<RadarFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name").slice(0, 160);
  const start = get("start");
  const end = get("end") || start;
  const link = get("link");
  const category = get("category");
  if (!name) return { error: "Give the event a name." };
  if (!isDate(start) || !isDate(end)) return { error: "Add the date it starts." };
  if (end < start) return { error: "The end date is before the start date." };
  if (link && !/^https?:\/\//.test(link)) return { error: "The event link should start with https://" };

  const { error } = await (await createClient()).rpc("admin_add_radar_event", {
    p_name: name,
    p_start: start,
    p_end: end,
    p_category: (RADAR_CATEGORIES as readonly string[]).includes(category) ? category : null,
    p_format: get("format") === "online" ? "online" : "in person",
    p_venue: get("venue").slice(0, 200),
    p_organizer: get("organizer").slice(0, 200),
    p_link: link.slice(0, 500),
    p_contact: get("contact").slice(0, 200),
    p_angle: get("angle").slice(0, 1000),
  });
  if (error) {
    console.error("admin_add_radar_event failed", error.code, error.message);
    if (error.code === "23505") return { error: "That event is already on the radar." };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't add the event." };
  }
  done();
  return { ok: `Added ${name}.` };
}
