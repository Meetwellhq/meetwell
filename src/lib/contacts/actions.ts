"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUser } from "../supabase/server";

const slugOk = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9-]{1,64}$/i.test(s);

/** Keep a card in my Contacts (called when a logged-in member opens someone's card). */
export async function saveContact(slug: string, source: "qr" | "link"): Promise<{ saved: boolean }> {
  if (!slugOk(slug) || !(await getCurrentUser())) return { saved: false };
  const { data, error } = await (await createClient()).rpc("save_contact", { p_slug: slug, p_source: source });
  if (error) console.error("save_contact failed", error.code, error.message);
  return { saved: data === true };
}

/** Bring cards saved on this phone before signing up (or while logged out) into Contacts. */
export async function importDeviceCards(cards: { slug: string; source: "qr" | "link" }[]): Promise<{ imported: number }> {
  if (!(await getCurrentUser())) return { imported: 0 };
  const supabase = await createClient();
  let imported = 0;
  for (const c of cards.filter((c) => slugOk(c.slug)).slice(0, 50)) {
    const { data } = await supabase.rpc("save_contact", { p_slug: c.slug, p_source: c.source === "qr" ? "qr" : "link" });
    if (data === true) imported++;
  }
  if (imported) revalidatePath("/dashboard/contacts");
  return { imported };
}

export async function setContactNote(slug: string, note: string): Promise<{ error?: string }> {
  if (!slugOk(slug) || !(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("set_contact_note", { p_slug: slug, p_note: note.slice(0, 300) });
  if (error) return { error: "Couldn't save the note." };
  revalidatePath("/dashboard/contacts");
  return {};
}

export async function removeContact(slug: string): Promise<{ error?: string }> {
  if (!slugOk(slug) || !(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("remove_contact", { p_slug: slug });
  if (error) return { error: "Couldn't remove them." };
  revalidatePath("/dashboard/contacts");
  return {};
}

/** Settings: "saved your card back" emails on or off. */
export async function setSavebackEmails(on: boolean): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("set_saveback_emails", { p_on: on });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/settings");
  return {};
}

export type UnsubscribeSavebackState = { done?: boolean; error?: string };

/** One-click "turn off" from the email link (no login). */
export async function unsubscribeSavebackEmails(_: UnsubscribeSavebackState, formData: FormData): Promise<UnsubscribeSavebackState> {
  const token = z.uuid().safeParse(formData.get("token"));
  if (!token.success) return { error: "This link isn't valid. Turn emails off in Settings instead." };
  const { data, error } = await (await createClient()).rpc("unsubscribe_saveback_emails", { p_token: token.data });
  if (error || data !== true) return { error: "This link isn't valid. Turn emails off in Settings instead." };
  return { done: true };
}
