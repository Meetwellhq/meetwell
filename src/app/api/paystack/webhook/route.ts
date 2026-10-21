import { createClient } from "@/lib/supabase/server";
import { confirmWithPaystack } from "@/lib/payments/paystack";
import { isValidPaystackSignature } from "@/lib/payments/signature";

/**
 * Paystack tells us about payments and transfers here (set this URL in the
 * Paystack dashboard: Settings → API Keys & Webhooks). Every request must carry
 * a valid signature. Payments are still re-checked with Paystack before anything
 * is applied.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!isValidPaystackSignature(raw, request.headers.get("x-paystack-signature"), secretKey)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string; transfer_code?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const reference = event.data?.reference;
  if (typeof reference !== "string") return Response.json({ ok: true });

  try {
    if (event.event === "charge.success" && reference.startsWith("mw_")) {
      const result = await confirmWithPaystack(reference);
      console.log("Paystack webhook", reference, result.result, result.kind);
    }

    // Mentor withdrawals.
    const transfer = { "transfer.success": "success", "transfer.failed": "failed", "transfer.reversed": "reversed" }[
      event.event ?? ""
    ];
    if (transfer && reference.startsWith("mwp_")) {
      const secret = process.env.CRON_SECRET;
      if (!secret) throw new Error("CRON_SECRET is not set");
      const { error } = await (await createClient()).rpc("record_transfer_result", {
        p_token: secret,
        p_reference: reference,
        p_result: transfer,
        p_transfer_code: event.data?.transfer_code ?? null,
      });
      if (error) throw new Error(error.message);
      console.log("Paystack transfer", reference, transfer);
    }
  } catch (err) {
    console.error("Paystack webhook failed", reference, err);
    // A non-200 makes Paystack try again later.
    return Response.json({ error: "retry" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
