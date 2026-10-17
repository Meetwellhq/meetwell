"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteUrl } from "../config";
import { limitByClient } from "../rate-limit";
import { createClient } from "../supabase/server";
import { emailSchema, fieldErrors, passwordSchema } from "../validation";

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
  if (!(await limitByClient("sign-up", 5, 10 * 60_000))) {
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
  if (error) {
    return { error: error.code === "weak_password" ? error.message : "We couldn't create your account. Please try again.", email };
  }

  // With email confirmation enabled (the default), no session is returned yet.
  if (!data.session) {
    return {
      message: `We sent a confirmation link to ${parsed.data.email}. Open it on this device to finish creating your card.`,
      email,
    };
  }
  redirect("/onboarding");
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  if (!(await limitByClient("sign-in", 10, 10 * 60_000))) {
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
  if (!(await limitByClient("reset", 5, 15 * 60_000))) {
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
