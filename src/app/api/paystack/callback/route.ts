import { redirect } from "next/navigation";
import { confirmWithPaystack } from "@/lib/payments/paystack";

/**
 * Where Paystack sends the member after paying (?reference=…). We check the
 * payment with Paystack straight away, so credits usually show at once; the
 * webhook covers anyone who closes the page early.
 */
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  let result = "pending";
  if (/^mw_[0-9a-f]{32}$/.test(reference)) {
    try {
      result = await confirmWithPaystack(reference);
    } catch (err) {
      console.error("Paystack callback check failed", reference, err);
    }
  }
  redirect(`/dashboard/matches?credits=${result === "already" ? "added" : result}`);
}
