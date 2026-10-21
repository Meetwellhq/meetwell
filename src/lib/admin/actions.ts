"use server";

import { revalidatePath } from "next/cache";
import { getSiteUrl, publicProfilePath, publicProfileUrl } from "../config";
import { buildFeatureMemberEmail, sendFeatureMemberEmail, sendInviteEmail } from "../email";
import type { FeaturedMember } from "../founder-emails";
import { getPublicProfile } from "../profiles/queries";
import { createClient, getCurrentUser } from "../supabase/server";
import { emailSchema } from "../validation";

export type InviteState = { ok?: boolean; error?: string };

/**
 * Invite one person from the waiting list: create (or reuse) their personal
 * access code, then email it. The database refuses anyone who isn't an admin.
 */
export async function inviteFromWaitlist(_: InviteState, formData: FormData): Promise<InviteState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Invalid email." };
  const fullName = String(formData.get("fullName") ?? "").slice(0, 80) || null;

  const supabase = await createClient();
  const { data: code, error } = await supabase.rpc("admin_invite", { p_email: email.data });
  if (error || typeof code !== "string") {
    console.error("admin_invite failed", error?.code, error?.message);
    return { error: error?.code === "42501" ? "You don't have access to invites." : "Couldn't create the invite." };
  }

  const sent = await sendInviteEmail(email.data, fullName, code);
  revalidatePath("/dashboard/invites");
  return sent ? { ok: true } : { error: `Code created (${code}) but the email didn't send. Try again.` };
}

const FEATURE_BATCH = 80;
const PREVIEW_TOKEN = "00000000-0000-4000-8000-000000000000";

export type FeatureState = {
  error?: string;
  /** Preview */
  subject?: string;
  html?: string;
  audience?: number;
  /** Send result */
  sent?: number;
  failed?: number;
  remaining?: number;
};

/** Loads a published member's public card for the email, or null. */
async function featuredMember(slug: string) {
  const profile = await getPublicProfile(slug);
  if (!profile) return null;
  const site = getSiteUrl();
  const member: FeaturedMember = {
    fullName: profile.fullName,
    title: profile.title,
    organization: profile.organization,
    avatarUrl: profile.avatarUrl,
    cardUrl: publicProfileUrl(profile.slug),
    qrImageUrl: `${site}${publicProfilePath(profile.slug)}/qr`,
  };
  return { slug: profile.slug, member };
}

function readFeatureForm(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? "").trim().toLowerCase().slice(0, 40),
    note: String(formData.get("note") ?? "").trim().slice(0, 600),
  };
}

async function audienceCount(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_feature_audience_count", { p_slug: slug });
  if (error) return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't count recipients." };
  return { count: Number(data) };
}

/** Builds a preview of the email and counts who would get it. Sends nothing. */
export async function previewFeature(_: FeatureState, formData: FormData): Promise<FeatureState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { slug, note } = readFeatureForm(formData);
  if (!slug) return { error: "Pick a member to feature." };
  const found = await featuredMember(slug);
  if (!found) return { error: "That card isn't published, so it can't be featured." };
  const counted = await audienceCount(found.slug);
  if ("error" in counted) return { error: counted.error };
  const { subject, html } = buildFeatureMemberEmail("Ada", PREVIEW_TOKEN, found.member, note);
  return { subject, html, audience: counted.count };
}

/**
 * Sends the feature to the next batch of the waiting list. Each person gets each
 * feature at most once (recorded by the database), so pressing Send again only
 * continues with whoever hasn't had it yet.
 */
export async function sendFeature(_: FeatureState, formData: FormData): Promise<FeatureState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { slug, note } = readFeatureForm(formData);
  if (formData.get("consent") !== "on") return { error: "Confirm you have their permission first." };
  const found = await featuredMember(slug);
  if (!found) return { error: "That card isn't published, so it can't be featured." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_claim_feature_recipients", {
    p_slug: found.slug,
    p_limit: FEATURE_BATCH,
  });
  if (error) {
    console.error("admin_claim_feature_recipients failed", error.code, error.message);
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't start sending." };
  }

  let sent = 0;
  let failed = 0;
  for (const r of (data ?? []) as { email: string; full_name: string | null; unsubscribe_token: string }[]) {
    const ok = await sendFeatureMemberEmail(r.email, r.full_name, r.unsubscribe_token, found.member, note);
    if (ok) sent++;
    else failed++;
    // Stay under Resend's rate limit.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  const counted = await audienceCount(found.slug);
  return { sent, failed, remaining: "count" in counted ? counted.count : undefined };
}
