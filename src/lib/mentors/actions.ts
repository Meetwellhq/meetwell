"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteUrl } from "../config";
import { createRecipient, initializeTransaction, paymentsEnabled, resolveAccount } from "../payments/paystack";
import { rateLimit } from "../rate-limit";
import { isEventSlug } from "../events";
import { createClient, getCurrentUser } from "../supabase/server";

export type Result = { ok?: boolean; error?: string; message?: string };

export async function applyAsMentor(): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("apply_as_mentor");
  if (error) return { error: error.code === "42501" ? "Finish the checklist first." : "Couldn't send your application." };
  revalidatePath("/dashboard/mentor", "layout");
  return { ok: true };
}

/** Price in naira (whole hundreds) or free, and whether new members can message. */
export async function saveMentorOffer(priceNaira: number, accepting: boolean, free = false): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const kobo = free ? 0 : Math.round(priceNaira / 100) * 100 * 100;
  if (!free && !(kobo >= 200000 && kobo <= 2000000)) return { error: "Choose a price between ₦2,000 and ₦20,000." };
  const { error } = await (await createClient()).rpc("set_mentor_offer", { p_price_kobo: kobo, p_accepting: accepting });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/mentor", "layout");
  return { ok: true };
}

const ACCOUNT_RE = /^\d{10}$/;

/** Step 1 of adding a bank account: ask the bank for the account name. Nothing is saved. */
export async function lookUpAccount(bankCode: string, accountNumber: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  if (!paymentsEnabled()) return { error: "Withdrawals aren't open yet." };
  if (!rateLimit(`resolve:${user.id}`, 10, 10 * 60_000)) return { error: "Too many tries. Please wait a few minutes." };
  if (!bankCode || !ACCOUNT_RE.test(accountNumber)) return { error: "Choose your bank and enter your 10-digit account number." };
  try {
    return { ok: true, message: await resolveAccount(accountNumber, bankCode) };
  } catch {
    return { error: "We couldn't find that account. Check the bank and number." };
  }
}

/** Step 2: register the account with Paystack and save it as where withdrawals go. */
export async function savePayoutAccount(bankCode: string, bankName: string, accountNumber: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  const secret = process.env.CRON_SECRET;
  if (!paymentsEnabled() || !secret) return { error: "Withdrawals aren't open yet." };
  if (!rateLimit(`payout-account:${user.id}`, 5, 10 * 60_000)) return { error: "Too many tries. Please wait a few minutes." };
  if (!bankCode || !ACCOUNT_RE.test(accountNumber)) return { error: "Choose your bank and enter your 10-digit account number." };

  try {
    const name = await resolveAccount(accountNumber, bankCode);
    const recipient = await createRecipient({ name, accountNumber, bankCode });
    const { error } = await (await createClient()).rpc("save_payout_account", {
      p_token: secret,
      p_user: user.id,
      p_bank_code: bankCode,
      p_bank_name: bankName.slice(0, 80),
      p_last4: accountNumber.slice(-4),
      p_account_name: name.slice(0, 120),
      p_recipient_code: recipient,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("savePayoutAccount failed", err);
    return { error: "We couldn't add that account. Please try again." };
  }
  revalidatePath("/dashboard/mentor", "layout");
  return { ok: true };
}

export async function requestWithdrawal(amountNaira: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  if (!rateLimit(`withdraw:${user.id}`, 5, 10 * 60_000)) return { error: "Please wait a few minutes and try again." };
  const kobo = Math.floor(amountNaira) * 100;
  const { error } = await (await createClient()).rpc("request_withdrawal", { p_amount_kobo: kobo });
  if (error) {
    if (error.code === "22023") return { error: error.message.replace(/N(?=\d)/g, "₦") };
    return { error: "Couldn't request the withdrawal. Please try again." };
  }
  revalidatePath("/dashboard/mentor", "layout");
  return { ok: true };
}

export type SubscribeState = { error?: string };

/** Starts paying for 30 days of messages with a mentor, then sends the member to Paystack. */
/** Start (or extend by 30 days) a free conversation with a mentor who takes free messages. */
export async function startFreeConversation(_: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  if (!rateLimit(`free-chat:${user.id}`, 10, 60_000)) return { error: "Please wait a moment and try again." };
  const slug = String(formData.get("slug") ?? "");
  const event = formData.get("event");
  // From an event page: the conversation is tagged with that event (counted for its partner).
  const { data, error } = await (await createClient()).rpc("start_free_conversation", {
    p_slug: slug,
    p_event: isEventSlug(event) ? event : null,
  });
  if (error || typeof data !== "number") {
    if (error?.code === "42501") return { error: "Messaging mentors is for members earlier in their careers." };
    if (error?.code === "22023") return { error: "This person isn't taking free messages right now." };
    return { error: "Couldn't start the conversation. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/messages/${data}`);
}

export async function subscribeToMentor(_: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  if (!paymentsEnabled()) return { error: "Payments aren't open yet." };
  if (!rateLimit(`subscribe:${user.id}`, 5, 60_000)) return { error: "Please wait a moment and try again." };
  const slug = String(formData.get("slug") ?? "");
  const event = formData.get("event");

  const { data, error } = await (await createClient()).rpc("start_subscription_purchase", {
    p_slug: slug,
    p_event: isEventSlug(event) ? event : null,
  });
  const row = (data as { reference: string; amount_kobo: number; email: string; mentor_name: string }[] | null)?.[0];
  if (error || !row) {
    if (error?.code === "42501") return { error: "Messaging mentors is for members earlier in their careers." };
    if (error?.code === "22023") return { error: "This person isn't taking new messages right now." };
    return { error: "Couldn't start the payment. Please try again." };
  }

  let checkout: string;
  try {
    checkout = await initializeTransaction({
      email: row.email,
      amountKobo: row.amount_kobo,
      reference: row.reference,
      callbackUrl: `${getSiteUrl()}/api/paystack/callback`,
      metadata: { kind: "mentor_subscription", mentor: slug, days: 30, ...(isEventSlug(event) ? { event } : {}) },
    });
  } catch (err) {
    console.error("Paystack initialize failed", err);
    return { error: "Couldn't reach Paystack. Please try again." };
  }
  redirect(checkout);
}
