import { describe, expect, it } from "vitest";
import { audienceParams, parseAudience } from "@/lib/admin/campaigns";

describe("parseAudience", () => {
  it("brings a template's suggested audience when only the template is picked", () => {
    expect(parseAudience({ template: "publish_card" })).toMatchObject({ card: "draft", noPhoto: false });
    expect(parseAudience({ template: "add_photo" })).toMatchObject({ card: "published", noPhoto: true });
    expect(parseAudience({ template: "finish_profile" })).toMatchObject({ card: "published", under80: true });
    expect(parseAudience({})).toMatchObject({ template: "publish_card", card: "draft" });
  });

  it("keeps the admin's own choices once they change a filter", () => {
    const a = parseAudience({ template: "add_photo", role: "mentee", card: "all", photo: "any", under80: "0", inactive: "30", resend: "14" });
    expect(a).toEqual({ template: "add_photo", role: "mentee", card: "all", noPhoto: false, under80: false, inactiveDays: 30, resendDays: 14 });
  });

  it("ignores values it doesn't know", () => {
    const a = parseAudience({ template: "nope", role: "boss", card: "x", inactive: "3", resend: "999" });
    expect(a).toMatchObject({ template: "publish_card", role: "all", card: "all", inactiveDays: null, resendDays: null });
  });

  it("round-trips through the address", () => {
    const a = parseAudience({ template: "mentoring", role: "mentor", card: "published", photo: "none", under80: "1", inactive: "7", resend: "30" });
    expect(parseAudience(audienceParams(a))).toEqual(a);
  });
});
