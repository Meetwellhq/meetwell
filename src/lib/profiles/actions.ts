"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { limitByClient, rateLimit } from "../rate-limit";
import { createClient, getCurrentUser } from "../supabase/server";
import { fieldErrors, profileInputSchema, slugSchema } from "../validation";
import { AVATAR_BUCKET } from "./avatar";
import { getOwnProfile } from "./queries";
import type { EventType } from "./types";

export type SaveProfileResult =
  | { ok: true; slug: string; status: "draft" | "published" | "unpublished" }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Create or update the signed-in user's profile. All input is validated and
 * normalised on the server; ownership is enforced by RLS.
 */
export async function saveProfile(
  input: unknown,
  options: { publish?: boolean } = {},
): Promise<SaveProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!rateLimit(`save-profile:${user.id}`, 30, 60_000)) {
    return { ok: false, error: "You're saving very quickly. Please wait a moment and try again." };
  }

  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const p = parsed.data;

  // Avatars must live in the user's own storage folder.
  if (p.avatarUrl && !p.avatarUrl.includes(`/${AVATAR_BUCKET}/${user.id}/`)) {
    return { ok: false, error: "Please re-upload your photo.", fieldErrors: { avatarUrl: "Invalid photo" } };
  }

  const supabase = await createClient();
  const existing = await getOwnProfile();

  if (existing?.publishedAt && existing.slug !== p.slug) {
    return {
      ok: false,
      error: "Your link is permanent once published, so printed QR codes keep working.",
      fieldErrors: { slug: "This link can't be changed after publishing" },
    };
  }

  const row = {
    user_id: user.id,
    slug: p.slug,
    full_name: p.fullName,
    avatar_url: p.avatarUrl,
    professional_title: p.title,
    organization: p.organization,
    bio: p.bio,
    website_url: p.websiteUrl,
    website_is_public: p.websiteIsPublic,
    networking_goals: p.networkingGoals,
    ...(options.publish ? { status: "published" as const } : existing ? {} : { status: "draft" as const }),
  };

  const { data: saved, error } = existing
    ? await supabase.from("profiles").update(row).eq("id", existing.id).select("id, status").single()
    : await supabase.from("profiles").insert(row).select("id, status").single();

  if (error || !saved) {
    if (error?.code === "23505") {
      return { ok: false, error: "That link is already taken.", fieldErrors: { slug: "Already taken — try another" } };
    }
    return { ok: false, error: "We couldn't save your profile. Please try again." };
  }

  const { error: childError } = await supabase.rpc("replace_profile_children", {
    p_profile_id: saved.id,
    p_contacts: p.contacts,
    p_socials: p.socials,
  });
  if (childError) {
    return { ok: false, error: "Your details were saved, but contact links failed. Please try again." };
  }

  // Remove a replaced avatar file so storage doesn't accumulate orphans.
  if (existing?.avatarUrl && existing.avatarUrl !== p.avatarUrl) {
    await removeAvatarFiles(user.id, [p.avatarUrl]);
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/p/${p.slug}`);
  return { ok: true, slug: p.slug, status: saved.status };
}

export async function setProfilePublished(publish: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ status: publish ? "published" : "unpublished" })
    .eq("user_id", user.id)
    .select("slug")
    .single();
  if (error || !data) return { ok: false, error: "We couldn't update your profile. Please try again." };
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/p/${data.slug}`);
  return { ok: true };
}

/** Is this slug free (or already the caller's own)? */
export async function checkSlugAvailability(slug: string): Promise<{ available: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { available: false, error: "Please sign in again." };
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { available: false, error: parsed.error.issues[0]?.message };
  if (!rateLimit(`slug-check:${user.id}`, 60, 60_000)) return { available: false, error: "Slow down a little." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_slug_available", { p_slug: parsed.data });
  if (error) return { available: false, error: "Couldn't check that link right now." };
  return { available: !!data };
}

async function removeAvatarFiles(userId: string, keep: (string | null)[] = []) {
  const supabase = await createClient();
  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const toRemove = (files ?? [])
    .map((f) => `${userId}/${f.name}`)
    .filter((path) => !keep.some((url) => url?.includes(path)));
  if (toRemove.length) await supabase.storage.from(AVATAR_BUCKET).remove(toRemove);
}

/** Delete the profile and its contact data. The account stays. */
export async function deleteProfile(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const existing = await getOwnProfile();
  await removeAvatarFiles(user.id);
  const { error } = await supabase.from("profiles").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "We couldn't delete your profile. Please try again." };
  if (existing) revalidatePath(`/p/${existing.slug}`);
  revalidatePath("/dashboard", "layout");
  redirect("/onboarding");
}

/** Permanently delete the account, profile, events and photo. */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const existing = await getOwnProfile();
  await removeAvatarFiles(user.id);
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, error: "We couldn't delete your account. Please try again." };
  await supabase.auth.signOut();
  if (existing) revalidatePath(`/p/${existing.slug}`);
  redirect("/?deleted=1");
}

const eventSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  type: z.enum([
    "view",
    "save_contact",
    "email_click",
    "phone_click",
    "website_click",
    "social_click",
    "copy_message",
  ] satisfies EventType[]),
  source: z.enum(["qr", "link"]).nullable().optional(),
});

/** Anonymous, aggregate engagement counter. Failures are silent by design. */
export async function recordProfileEvent(input: {
  slug: string;
  type: EventType;
  source?: "qr" | "link" | null;
}): Promise<void> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return;
  if (!(await limitByClient(`event:${parsed.data.slug}`, 20, 60_000))) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("record_profile_event", {
      p_slug: parsed.data.slug,
      p_event_type: parsed.data.type,
      p_source: parsed.data.source ?? null,
    });
  } catch {
    // Analytics must never break the visitor experience.
  }
}
