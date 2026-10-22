import { describe, expect, it } from "vitest";
import { inviteLink, outreachMessage, parseOutreachList, xHandle } from "@/lib/outreach";

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

describe("pasting a list", () => {
  it("reads names, handles, links and notes in any order", () => {
    const { entries, bad } = parseOutreachList(
      [
        "Daniel @danbuilds",
        "https://x.com/Amaka_Designs Amaka",
        "Tunde Bello, x.com/tunde_ml, ML engineer, at a bank",
        "@kemi_codes",
        "",
        "@danbuilds again",
        "just some words",
      ].join("\n"),
    );
    expect(entries).toEqual([
      { firstName: "Daniel", handle: "danbuilds", note: null },
      { firstName: "Amaka", handle: "amaka_designs", note: null },
      { firstName: "Tunde", handle: "tunde_ml", note: "ML engineer, at a bank" },
      { firstName: null, handle: "kemi_codes", note: null },
    ]);
    expect(bad).toEqual(["just some words"]);
  });

  it("says hi there when there's no name", () => {
    expect(outreachMessage(null, "https://meetwell.me").startsWith("Hi there,")).toBe(true);
  });
});
