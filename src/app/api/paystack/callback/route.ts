import { redirect } from "next/navigation";
import { type Confirmed, confirmWithPaystack } from "@/lib/payments/paystack";

/**
 * Where Paystack sends the member after paying (?reference=…). We check the
 * payment with Paystack straight away, so it usually applies at once; the
 * webhook covers anyone who closes the page early.
 */
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  let confirmed: Confirmed = { result: "pending" };
  if (/^mw_[0-9a-f]{32}$/.test(reference)) {
    try {
      confirmed = await confirmWithPaystack(reference);
    } catch (err) {
      console.error("Paystack callback check failed", reference, err);
    }
  }
  const done = confirmed.result === "added" || confirmed.result === "already";
  if (confirmed.kind === "subscription" && done && confirmed.conversationId) {
    redirect(`/dashboard/messages/${confirmed.conversationId}?paid=1`);
  }
  if (confirmed.kind === "subscription") redirect(`/dashboard/messages?payment=${confirmed.result}`);
  redirect(`/dashboard/matches?credits=${done ? "added" : confirmed.result}`);
}
