import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidPaystackSignature } from "@/lib/payments/signature";

describe("Paystack webhook signature", () => {
  const key = "sk_test_example_not_a_real_key";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "mw_123" } });
  const sign = (b: string, k = key) => createHmac("sha512", k).update(b).digest("hex");

  it("accepts Paystack's signature for the exact body", () => {
    expect(isValidPaystackSignature(body, sign(body), key)).toBe(true);
  });

  it("refuses a missing, wrong or tampered signature", () => {
    expect(isValidPaystackSignature(body, null, key)).toBe(false);
    expect(isValidPaystackSignature(body, "abc", key)).toBe(false);
    expect(isValidPaystackSignature(body, sign(body, "another_key"), key)).toBe(false);
    expect(isValidPaystackSignature(body.replace("mw_123", "mw_999"), sign(body), key)).toBe(false);
    expect(isValidPaystackSignature(body, sign(body), "")).toBe(false); // no key set: refuse everything
  });
});
