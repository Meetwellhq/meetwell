"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rateLimit } from "../rate-limit";
import { createClient, getCurrentUser } from "../supabase/server";
import { fieldErrors } from "../validation";
import { FIELDS, LOOKING_FOR } from "./constants";

export type MatchingPrefsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const prefsSchema = z
  .object({
    optIn: z.boolean(),
    field: z.enum(FIELDS.map((f) => f.value) as [string, ...string[]]).nullable(),
    experienceYears: z.coerce.number().int().min(0, "Enter 0 or more").max(60, "Enter 60 or less").nullable(),
    lookingFor: z.array(z.enum(LOOKING_FOR.map((l) => l.value) as [string, ...string[]])).max(LOOKING_FOR.length),
    city: z.string().trim().max(60, "Keep this under 60 characters").transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    // Matching needs at least a field and experience to work.
    if (v.optIn && !v.field) ctx.addIssue({ code: "custom", path: ["field"], message: "Pick your field to turn on matching" });
    if (v.optIn && v.experienceYears === null)
      ctx.addIssue({ code: "custom", path: ["experienceYears"], message: "Add your years of experience" });
  });

/** Saves the member's matching details and opt-in. Ownership is enforced by RLS. */
export async function saveMatchingPrefs(_: MatchingPrefsState, formData: FormData): Promise<MatchingPrefsState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Please log in again." };
  if (!rateLimit(`matching-prefs:${user.id}`, 20, 60_000)) return { error: "Please wait a moment and try again." };

  const years = String(formData.get("experienceYears") ?? "").trim();
  const parsed = prefsSchema.safeParse({
    optIn: formData.get("optIn") === "on",
    field: String(formData.get("field") ?? "") || null,
    experienceYears: years === "" ? null : years,
    lookingFor: formData.getAll("lookingFor").map(String),
    city: String(formData.get("city") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      matching_opt_in: parsed.data.optIn,
      field: parsed.data.field,
      experience_years: parsed.data.experienceYears,
      looking_for: [...new Set(parsed.data.lookingFor)],
      city: parsed.data.city,
    })
    .eq("user_id", user.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("saveMatchingPrefs failed", error.code, error.message);
    return { error: "Couldn't save. Create your card first, then try again." };
  }
  revalidatePath("/dashboard/matches");
  return { ok: true };
}
