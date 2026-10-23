"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteUrl, SIGNUPS_OPEN } from "../config";
import { sendWaitlistEmail } from "../email";
import { limitByClient } from "../rate-limit";
import { createClient } from "../supabase/server";
import { emailSchema, fieldErrors, passwordSchema } from "../validation";
import { classifySignUp } from "./sign-up-result";

// Per-IP limits. Kept generous because attendees at an event often share one
// Wi-Fi network (one IP); Supabase Auth applies its own limits as well.
const LIMITS = {
  signUp: { max: 30, windowMs: 10 * 60_000 },
  signIn: { max: 60, windowMs: 10 * 60_000 },
  reset: { max: 20, windowMs: 15 * 60_000 },
  waitlist: { max: 20, windowMs: 10 * 60_000 },
  accessCode: { max: 20, windowMs: 10 * 60_000 },
};

export type AuthFormState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  email?: string;
  /** Other text fields to refill after an error, by field name. */
  values?: Record<string, string>;
};

/** Only allow same-site relative redirects after auth. */
function safeNext(value: FormDataEntryValue | null, fallback = "/dashboard") {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });

const INVALID_CODE = "That access code isn't valid or has already been used. Check your invite, or request early access.";

const CARD_FULL =
  "This card can't invite more people right now. Use an access code if you have one, or request early access.";
const PARTNER_CLOSED =
  "This invite link isn't open right now. Use an access code if you have one, or request early access.";

/** Card links saved on the visitor's phone, sent along with sign-up (slugs only, up to 50). */
function parseSavedCards(value: FormDataEntryValue | null): string[] {
  try {
    const list = JSON.parse(typeof value === "string" ? value.slice(0, 5000) : "[]");
    if (!Array.isArray(list)) return [];
    return [...new Set(list.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,64}$/i.test(s)).map((s) => s.toLowerCase()))].slice(0, 50);
  } catch {
    return [];
  }
}

export type AccessCodeState = { error?: string; code?: string; input?: string };

/** Step 1 of invite sign-up: check the code before asking for email and password. */
export async function verifyAccessCode(_: AccessCodeState, formData: FormData): Promise<AccessCodeState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!(await limitByClient("access-code", LIMITS.accessCode.max, LIMITS.accessCode.windowMs))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", input: code };
  }
  if (!code) return { error: "Enter the access code from your invite." };
  if (code.length > 64) return { error: INVALID_CODE, input: code.slice(0, 64) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_access_code", { p_code: code });
  if (error) {
    console.error("check_access_code failed", error.code, error.message);
    return { error: "We couldn't check that code right now. Please try again in a moment.", input: code };
  }
  return data === true ? { code } : { error: INVALID_CODE, input: code };
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  // During the private beta, new accounts need an access code (also enforced in the database).
  const accessCode = String(formData.get("accessCode") ?? "").trim().slice(0, 64);
  if (!(await limitByClient("sign-up", LIMITS.signUp.max, LIMITS.signUp.windowMs))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  const adult = formData.get("adult") === "yes";
  if (!parsed.success || !adult) {
    const errors = parsed.success ? {} : fieldErrors(parsed.error);
    if (!adult) errors.adult = "You need to be 18 or older to use Meetwell.";
    return { fieldErrors: errors, email };
  }

  // Joining through someone's card: that card counts as the invite (20 per card,
  // checked again in the database), and cards saved on this phone come along.
  const viaCard = String(formData.get("viaCard") ?? "").trim().toLowerCase().slice(0, 64);
  // Joining through a partner's link (an event platform): it works as an invite and is recorded for good.
  const viaPartner = String(formData.get("viaPartner") ?? "").trim().toLowerCase().slice(0, 64);
  const savedCards = parseSavedCards(formData.get("savedCards"));

  const supabase = await createClient();
  if (!SIGNUPS_OPEN) {
    const { data: valid } = accessCode ? await supabase.rpc("check_access_code", { p_code: accessCode }) : { data: false };
    const { data: cardOpen } = valid !== true && viaCard ? await supabase.rpc("card_invite_open", { p_slug: viaCard }) : { data: false };
    const { data: partnerName } =
      valid !== true && cardOpen !== true && viaPartner
        ? await supabase.rpc("partner_invite_name", { p_slug: viaPartner })
        : { data: null };
    if (valid !== true && cardOpen !== true && !partnerName) {
      return { error: viaPartner ? PARTNER_CLOSED : viaCard ? CARD_FULL : INVALID_CODE, email };
    }
  }
  const meta: Record<string, unknown> = {};
  if (!SIGNUPS_OPEN && accessCode) meta.access_code = accessCode;
  if (viaCard) meta.via_card = viaCard;
  if (viaPartner) meta.via_partner = viaPartner;
  if (savedCards.length) meta.saved_cards = savedCards;
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/onboarding`,
      data: Object.keys(meta).length ? meta : undefined,
    },
  });
  const outcome = classifySignUp(data, error?.code);
  if (outcome === "exists") {
    return {
      error: "An account with this email already exists. Log in instead, or reset your password if you've forgotten it.",
      email,
    };
  }
  if (error) {
    if (error.code === "weak_password") return { error: error.message, email };
    // The database refused the account: the code (or the card's invites) ran out in the meantime.
    if (!SIGNUPS_OPEN && error.code === "unexpected_failure") {
      return { error: viaPartner ? PARTNER_CLOSED : viaCard ? CARD_FULL : INVALID_CODE, email };
    }
    console.error("signUp failed", error.code, error.message);
    return { error: "We couldn't create your account. Please try again.", email };
  }

  // With email confirmation enabled (the default), no session is returned yet.
  if (outcome === "confirm-email") {
    return {
      message: `We sent a confirmation link to ${parsed.data.email}. Open it to finish creating your card.`,
      email,
    };
  }
  redirect("/onboarding");
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  if (!(await limitByClient("sign-in", LIMITS.signIn.max, LIMITS.signIn.windowMs))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Enter your password") })
    .safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first — check your inbox for the link.", email };
    }
    // Say which one is wrong, so people know whether to fix the email or the password.
    const { data: exists } = await supabase.rpc("account_exists", { p_email: parsed.data.email });
    if (exists === false) {
      return {
        fieldErrors: { email: "We couldn't find an account with that email. Check it for typos." },
        email,
      };
    }
    if (exists === true) {
      return {
        fieldErrors: { password: "That password isn't right. Try again, or reset it below." },
        email,
      };
    }
    return { error: "That email and password don't match.", email };
  }
  redirect(safeNext(formData.get("next")));
}

/** Log-in for the admin area: only admin accounts get in; anyone else is signed straight out. */
export async function adminSignIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  if (!(await limitByClient("admin-sign-in", 10, 10 * 60_000))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Enter your password") })
    .safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first — check your inbox for the link.", email };
    }
    return { error: "That email and password don't match.", email };
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have admin access.", email };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  if (!(await limitByClient("reset", LIMITS.reset.max, LIMITS.reset.windowMs))) {
    return { error: "Too many requests. Please wait a few minutes and try again.", email };
  }
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message }, email };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });
  // Same response whether or not the account exists, to avoid account enumeration.
  return { message: "If an account exists for that email, we've sent a link to reset your password.", email };
}

export async function updatePassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "Your reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message || "We couldn't update your password." };
  redirect("/dashboard?password=updated");
}

export async function joinWaitlist(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const fullName = String(formData.get("fullName") ?? "").slice(0, 200);
  const values = { fullName };
  if (!(await limitByClient("waitlist", LIMITS.waitlist.max, LIMITS.waitlist.windowMs))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }
  const parsed = z
    .object({
      fullName: z.string().trim().min(1, "Enter your name").max(80, "Keep this under 80 characters"),
      email: emailSchema,
    })
    .safeParse({ fullName, email });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email, values };

  const supabase = await createClient();
  // Returns the person's unsubscribe token, or null if the email was already on the list.
  const { data: unsubscribeToken, error } = await supabase.rpc("join_waitlist_with_token", {
    p_email: parsed.data.email,
    p_full_name: parsed.data.fullName,
  });
  if (error) {
    console.error("join_waitlist failed", error.code, error.message);
    return { error: "We couldn't add you right now. Please try again in a moment.", email };
  }
  if (typeof unsubscribeToken !== "string") {
    return {
      fieldErrors: { email: "This email is already on the waiting list. We'll be in touch when your invite is ready." },
      email,
      values,
    };
  }
  // Only new emails get the confirmation, so the form can't be used to spam an inbox.
  await sendWaitlistEmail(parsed.data.email, parsed.data.fullName, unsubscribeToken);
  return {
    message: `You've joined the Meetwell waiting list! We'll email ${parsed.data.email} when your invite is ready.`,
  };
}

export type UnsubscribeState = { done?: boolean; error?: string };

/** One-click opt-out from occasional waiting-list updates (invites still go out). */
export async function unsubscribeFromUpdates(_: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const token = z.uuid().safeParse(formData.get("token"));
  if (!token.success) return { error: "This unsubscribe link isn't valid. Email us and we'll sort it out." };
  if (!(await limitByClient("unsubscribe", LIMITS.waitlist.max, LIMITS.waitlist.windowMs))) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsubscribe_waitlist", { p_token: token.data });
  if (error) {
    console.error("unsubscribe_waitlist failed", error.code, error.message);
    return { error: "We couldn't update your preference right now. Please try again in a moment." };
  }
  return data === true ? { done: true } : { error: "This unsubscribe link isn't valid. Email us and we'll sort it out." };
}
