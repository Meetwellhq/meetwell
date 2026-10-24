import { createHmac, timingSafeEqual } from "node:crypto";

/** Resend signs webhooks the Svix way; events older than this are refused (replays). */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Resend signs every webhook (Svix format): svix-signature holds one or more
 * "v1,<base64>" HMAC-SHA256 values of "<svix-id>.<svix-timestamp>.<raw body>",
 * keyed with the webhook's signing secret ("whsec_" + base64). Pure, so it can
 * be unit-tested.
 */
export function isValidResendSignature(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowMs = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowMs / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64"));
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
