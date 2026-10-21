import "server-only";
import { createClient } from "../supabase/server";

/**
 * Paystack, server side only. Needs PAYSTACK_SECRET_KEY (test key first, live
 * key only when Rasheed says so). Without it, payments are switched off.
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
  /** What the payment is for, shown in the Paystack dashboard. */
  metadata: Record<string, string | number>;
}) {
  const data = await paystack<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  return data.authorization_url;
}

type Verified = { status: string; reference: string; amount: number; currency: string; id: number };

export type Confirmed = {
  result: "added" | "already" | "pending" | "failed";
  kind?: "credits" | "subscription";
  conversationId?: number | null;
};

/**
 * Asks Paystack whether a payment went through, and if so applies it (credits,
 * or 30 days of messages plus the mentor's earnings), once; repeat calls are
 * harmless. Used by the webhook and the return page.
 */
export async function confirmWithPaystack(reference: string): Promise<Confirmed> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not set");
  const tx = await paystack<Verified>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const supabase = await createClient();

  if (tx.status !== "success") {
    if (tx.status === "failed" || tx.status === "abandoned") {
      await supabase.rpc("mark_payment_failed", { p_token: secret, p_reference: reference });
      return { result: "failed" };
    }
    return { result: "pending" };
  }
  const { data, error } = await supabase.rpc("confirm_payment", {
    p_token: secret,
    p_reference: tx.reference,
    p_amount_kobo: tx.amount,
    p_currency: tx.currency,
    p_paystack_id: tx.id,
  });
  if (error) throw new Error(`confirm_payment: ${error.message}`);
  const row = (data as { added: boolean; kind: Confirmed["kind"]; conversation_id: number | null }[] | null)?.[0];
  return { result: row?.added ? "added" : "already", kind: row?.kind, conversationId: row?.conversation_id };
}

// ---------------------------------------------------------------------------
// Mentor payouts (Paystack Transfers: needs the Registered Business upgrade)
// ---------------------------------------------------------------------------

export type Bank = { name: string; code: string };

/** Nigerian banks for the payout form, cached for a day. */
export async function listBanks(): Promise<Bank[]> {
  if (!paymentsEnabled()) return [];
  try {
    const res = await fetch(`${API}/bank?country=nigeria&currency=NGN&perPage=200`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { data?: { name: string; code: string; active?: boolean }[] } | null;
    return (body?.data ?? []).filter((b) => b.active !== false).map((b) => ({ name: b.name, code: b.code }));
  } catch {
    return [];
  }
}

/** The account holder's name for an account number, as the bank has it. */
export async function resolveAccount(accountNumber: string, bankCode: string) {
  const data = await paystack<{ account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  return data.account_name;
}

/** Registers the account with Paystack; we keep only the returned code and the last 4 digits. */
export async function createRecipient(input: { name: string; accountNumber: string; bankCode: string }) {
  const data = await paystack<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    }),
  });
  return data.recipient_code;
}

/** Sends a withdrawal. Paystack confirms later by webhook (transfer.success / transfer.failed). */
export async function sendTransfer(input: { amountKobo: number; recipientCode: string; reference: string }) {
  return paystack<{ status: string; transfer_code: string }>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: "Meetwell mentor earnings",
    }),
  });
}

/** Full refund of a payment back to the member. */
export async function refundPayment(reference: string) {
  return paystack<{ status: string }>("/refund", { method: "POST", body: JSON.stringify({ transaction: reference }) });
}
