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
};

export type AuthFormState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  email?: string;
};

/** Only allow same-site relative redirects after auth. */
function safeNext(value: FormDataEntryValue | null, fallback = "/dashboard") {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  if (!SIGNUPS_OPEN) {
    return { error: "Meetwell is in private beta. Join the early access list and we'll invite you soon.", email };
  }
  if (!(await limitByClient("sign-up", LIMITS.signUp.max, LIMITS.signUp.windowMs))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/onboarding` },
  });
  const outcome = classifySignUp(data, error?.code);
  if (outcome === "exists") {
    return {
      error: "An account with this email already exists. Sign in instead, or reset your password if you've forgotten it.",
      email,
    };
  }
  if (error) {
    return { error: error.code === "weak_password" ? error.message : "We couldn't create your account. Please try again.", email };
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
    return { error: "That email and password don't match.", email };
  }
  redirect(safeNext(formData.get("next")));
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
  if (!(await limitByClient("waitlist", LIMITS.waitlist.max, LIMITS.waitlist.windowMs))) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }
  const parsed = z.object({ email: emailSchema }).safeParse({ email });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email };

  const supabase = await createClient();
  const { data: isNew, error } = await supabase.rpc("join_waitlist", { p_email: parsed.data.email });
  if (error) {
    console.error("join_waitlist failed", error.code, error.message);
    return { error: "We couldn't add you right now. Please try again in a moment.", email };
  }
  // Email only on the first join, so the form can't be used to spam an inbox.
  if (isNew === true) await sendWaitlistEmail(parsed.data.email);
  // Same message whether or not the email was already on the list.
  return {
    message: `You've joined the Meetwell waiting list! We'll email ${parsed.data.email} when your invite is ready.`,
  };
}
