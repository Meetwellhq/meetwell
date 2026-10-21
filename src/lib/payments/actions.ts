"use server";

import { redirect } from "next/navigation";
import { getSiteUrl } from "../config";
import { rateLimit } from "../rate-limit";
import { createClient, getCurrentUser } from "../supabase/server";
import { initializeTransaction, paymentsEnabled } from "./paystack";

export type BuyState = { error?: string };

/** Starts buying a credit pack and sends the member to Paystack's checkout. */
export async function buyCredits(_: BuyState, formData: FormData): Promise<BuyState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  if (!paymentsEnabled()) return { error: "Buying credits isn't open yet." };
  if (!rateLimit(`buy-credits:${user.id}`, 5, 60_000)) return { error: "Please wait a moment and try again." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_credit_purchase", { p_pack: String(formData.get("pack") ?? "") });
  const row = (data as { reference: string; amount_kobo: number; credits: number; email: string }[] | null)?.[0];
  if (error || !row) {
    console.error("start_credit_purchase failed", error?.code, error?.message);
    return {
      error: error?.code === "42501" ? "Credits are for members getting introductions." : "Couldn't start the payment. Please try again.",
    };
  }

  let checkout: string;
  try {
    checkout = await initializeTransaction({
      email: row.email,
      amountKobo: row.amount_kobo,
      reference: row.reference,
      callbackUrl: `${getSiteUrl()}/api/paystack/callback`,
      credits: row.credits,
    });
  } catch (err) {
    console.error("Paystack initialize failed", err);
    return { error: "Couldn't reach Paystack. Please try again." };
  }
  redirect(checkout);
}
