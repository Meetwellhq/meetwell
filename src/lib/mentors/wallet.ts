import "server-only";
import { redirect } from "next/navigation";
import { isMentor } from "@/lib/matching/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/** Shared by the Mentoring, Wallet and Transactions pages. */

export type MentorStatus = {
  status: "applied" | "approved" | "rejected" | "paused" | null;
  price_kobo: number | null;
  accepting: boolean | null;
  checks: Record<string, boolean>;
  active_subscribers: number | null;
};
export type Wallet = {
  available_kobo: number;
  pending_kobo: number;
  next_release: string | null;
  earned_kobo: number;
  withdrawn_kobo: number;
  bank_name: string | null;
  account_last4: string | null;
  account_name: string | null;
};
export type Withdrawal = { id: number; amount_kobo: number; status: string; bank_name: string; account_last4: string; created_at: string; note: string | null };
export type Activity = { kind: string; amount_kobo: number; available_at: string; created_at: string; detail: string | null };

export const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

/** The signed-in member's mentor status; sends people under 4 years back to the dashboard. */
export async function requireMentor() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("slug, experience_years").eq("user_id", user!.id).maybeSingle();
  if (!isMentor(profile?.experience_years)) redirect("/dashboard");
  const { data } = await supabase.rpc("my_mentor_status");
  const status = ((data ?? []) as MentorStatus[])[0] ?? { status: null, price_kobo: null, accepting: null, checks: {}, active_subscribers: 0 };
  return { supabase, slug: profile?.slug ?? null, status, approved: status.status === "approved" || status.status === "paused" };
}
