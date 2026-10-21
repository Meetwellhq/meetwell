import { confirmWithPaystack } from "@/lib/payments/paystack";
import { isValidPaystackSignature } from "@/lib/payments/signature";

/**
 * Paystack tells us about payments here (set this URL in the Paystack
 * dashboard: Settings → API Keys & Webhooks). Every request must carry a valid
 * signature, and we still re-check the payment with Paystack before adding credits.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!isValidPaystackSignature(raw, request.headers.get("x-paystack-signature"), secretKey)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (event.event === "charge.success" && typeof reference === "string" && reference.startsWith("mw_")) {
    try {
      const result = await confirmWithPaystack(reference);
      console.log("Paystack webhook", reference, result);
    } catch (err) {
      console.error("Paystack webhook failed", reference, err);
      // A non-200 makes Paystack try again later.
      return Response.json({ error: "retry" }, { status: 500 });
    }
  }
  return Response.json({ ok: true });
}
