"use server";

import { z } from "zod";
import { limitByClient } from "./rate-limit";
import { createClient } from "./supabase/server";

export type RemoveCardState = { done?: string; error?: string };

/** A speaker removing the card a partner made for them, from the link in their email. */
export async function removeMySpeakerCard(_: RemoveCardState, formData: FormData): Promise<RemoveCardState> {
  const token = z.uuid().safeParse(formData.get("token"));
  if (!token.success) return { error: "This link isn't valid. Email us and we'll remove your card." };
  if (!(await limitByClient("remove-speaker-card", 10, 10 * 60_000))) return { error: "Too many attempts. Please wait a few minutes." };
  const { data, error } = await (await createClient()).rpc("remove_speaker_card_by_token", { p_token: token.data });
  if (error) {
    console.error("remove_speaker_card_by_token failed", error.code, error.message);
    return { error: "We couldn't remove it right now. Please try again in a moment." };
  }
  return typeof data === "string" ? { done: data } : { error: "This card has already been removed, or the link isn't valid." };
}
