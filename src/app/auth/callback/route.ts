import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for email links (sign-up confirmation and password reset).
 *
 * Prefer `token_hash` links (see README → email templates): they work on any
 * device. The default PKCE `code` links only finish in the browser that
 * started the flow, so opening the email elsewhere can't create a session —
 * but by then Supabase has already confirmed the email, so we say so.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const isReset = next.startsWith("/reset-password");

  const fail = (reason: "confirmed" | "expired" | "reset", detail?: string) => {
    console.error("[auth/callback] link failed", { reason, detail });
    return NextResponse.redirect(`${origin}/sign-in?error=${reason}`);
  };

  // Supabase redirects here with an error when the link was expired or already used.
  const upstreamError = searchParams.get("error_code") ?? searchParams.get("error");
  if (upstreamError) return fail(isReset ? "reset" : "expired", upstreamError);

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(isReset ? "reset" : "expired", error.code ?? error.message);
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // A code means Supabase already verified the email; only the session handoff failed
    // (usually the link was opened in a different browser or an email app's viewer).
    if (error) return fail(isReset ? "reset" : "confirmed", error.code ?? error.message);
    return NextResponse.redirect(`${origin}${next}`);
  }

  return fail(isReset ? "reset" : "expired", "missing code");
}
