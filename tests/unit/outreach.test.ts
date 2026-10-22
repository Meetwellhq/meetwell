import { describe, expect, it } from "vitest";
import { inviteLink, outreachMessage, xHandle } from "@/lib/outreach";

describe("outreach", () => {
  it("reads X handles from handles and profile links", () => {
    expect(xHandle("@DanBuilds")).toBe("danbuilds");
    expect(xHandle(" dan_1 ")).toBe("dan_1");
    expect(xHandle("https://x.com/DanBuilds?s=20")).toBe("danbuilds");
    expect(xHandle("twitter.com/@dan/status/123")).toBe("dan");
    expect(xHandle("not a handle!")).toBeNull();
    expect(xHandle("https://example.com/dan")).toBeNull();
  });

  it("fills in the first name and personal link", () => {
    const link = inviteLink("https://meetwell.me", "MW-AB12-CD34-EF56");
    expect(link).toBe("https://meetwell.me/access-code?code=MW-AB12-CD34-EF56");
    const msg = outreachMessage(" Daniel ", link);
    expect(msg.startsWith("Hi Daniel,\n")).toBe(true);
    expect(msg).toContain(link);
    expect(msg).toContain("Meetwell");
  });
});
