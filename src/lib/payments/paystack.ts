import "server-only";
import { createClient } from "../supabase/server";

/**
 * Paystack, server side only. Needs PAYSTACK_SECRET_KEY (test key first, live
 * key only when Rasheed says so). Without it, buying credits is switched off.
 * Card details never reach Meetwell: people pay on Paystack's own page.
 */
const API = "https://api.paystack.co";

export const paymentsEnabled = () => !!process.env.PAYSTACK_SECRET_KEY;

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status || !body.data) {
    throw new Error(`Paystack ${path} failed: ${res.status} ${body?.message ?? ""}`);
  }
  return body.data;
}

/** Opens a checkout for a pending payment and returns the page to send the member to. */
export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  credits: number;
}) {
  const data = await paystack<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: { kind: "spark_credits", credits: input.credits },
    }),
  });
  return data.authorization_url;
}

type Verified = { status: string; reference: string; amount: number; currency: string; id: number };

/**
 * Asks Paystack whether a payment went through, and if so adds the credits
 * (once; repeat calls are harmless). Used by the webhook and the return page.
 */
export async function confirmWithPaystack(reference: string): Promise<"added" | "already" | "pending" | "failed"> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not set");
  const tx = await paystack<Verified>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const supabase = await createClient();

  if (tx.status !== "success") {
    if (tx.status === "failed" || tx.status === "abandoned") {
      await supabase.rpc("mark_payment_failed", { p_token: secret, p_reference: reference });
      return "failed";
    }
    return "pending";
  }
  const { data, error } = await supabase.rpc("confirm_payment", {
    p_token: secret,
    p_reference: tx.reference,
    p_amount_kobo: tx.amount,
    p_currency: tx.currency,
    p_paystack_id: tx.id,
  });
  if (error) throw new Error(`confirm_payment: ${error.message}`);
  return (data as { added: boolean }[] | null)?.[0]?.added ? "added" : "already";
}
