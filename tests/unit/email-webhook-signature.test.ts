import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidResendSignature } from "@/lib/email-webhook-signature";

const secret = `whsec_${Buffer.from("a-test-signing-secret-32-bytes!!").toString("base64")}`;
const now = 1_800_000_000_000;
const timestamp = String(now / 1000);
const body = JSON.stringify({ type: "email.clicked", data: { email_id: "re_123" } });

function sign(id: string, ts: string, raw: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64")}`;
}

describe("isValidResendSignature", () => {
  it("accepts a correctly signed event", () => {
    expect(isValidResendSignature(body, { id: "msg_1", timestamp, signature: sign("msg_1", timestamp, body) }, secret, now)).toBe(true);
  });

  it("accepts it among several signatures (secret rotation)", () => {
    const signature = `v1,bm90LXJpZ2h0 ${sign("msg_1", timestamp, body)}`;
    expect(isValidResendSignature(body, { id: "msg_1", timestamp, signature }, secret, now)).toBe(true);
  });

  it("refuses a changed body, a wrong id, an old event or a missing secret", () => {
    const signature = sign("msg_1", timestamp, body);
    expect(isValidResendSignature(body.replace("re_123", "re_999"), { id: "msg_1", timestamp, signature }, secret, now)).toBe(false);
    expect(isValidResendSignature(body, { id: "msg_2", timestamp, signature }, secret, now)).toBe(false);
    expect(isValidResendSignature(body, { id: "msg_1", timestamp, signature }, secret, now + 10 * 60 * 1000)).toBe(false);
    expect(isValidResendSignature(body, { id: "msg_1", timestamp, signature }, "", now)).toBe(false);
    expect(isValidResendSignature(body, { id: "msg_1", timestamp, signature: null }, secret, now)).toBe(false);
  });
});
