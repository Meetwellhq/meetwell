import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack signs every webhook: x-paystack-signature is the HMAC-SHA512 of the
 * raw request body, keyed with our secret key. Pure, so it can be unit-tested.
 */
export function isValidPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !secretKey) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
