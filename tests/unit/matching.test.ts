import { describe, expect, it } from "vitest";
import { chooseMatch, ruleReason, type Candidate, type Seeker } from "@/lib/matching/engine";

const junior: Seeker = {
  fullName: "Tunde Bello", title: "Product Designer", organization: null, bio: null,
  field: "product_design", experienceYears: 1, lookingFor: ["mentor"], city: "Lagos",
};
const senior: Candidate = {
  profileId: "p1", slug: "ada", hasPhoto: true, score: 135,
  fullName: "Ada Obi", title: "Senior Product Designer", organization: "Studio North", bio: null,
  field: "product_design", experienceYears: 4, lookingFor: ["mentee"], city: "Lagos",
};

describe("matching fallback", () => {
  it("writes a factual reason from the profiles", () => {
    expect(ruleReason(junior, senior)).toBe(
      "Ada has 4 years in product design (3 more than you), is open to mentoring, and is also in Lagos.",
    );
  });

  it("picks the top candidate with the rule reason when there's no Claude key", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const choice = await chooseMatch(junior, [senior]);
      expect(choice?.candidate.slug).toBe("ada");
      expect(choice?.by).toBe("rules");
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it("returns nothing when there are no candidates", async () => {
    expect(await chooseMatch(junior, [])).toBeNull();
  });
});

describe("profile completeness", () => {
  it("counts ten items at 10% each and needs 80% for matching", async () => {
    const { profileCompleteness } = await import("@/lib/matching/completeness");
    const full = {
      avatarUrl: "https://x/p.jpg", title: "Designer", organization: "Studio", bio: "Hi",
      hasPublicContact: true, hasPublicLink: true, field: "product_design", experienceYears: 1,
      lookingFor: ["mentor"], city: "Lagos",
    };
    expect(profileCompleteness(full).percent).toBe(100);
    const thin = profileCompleteness({ ...full, avatarUrl: null, bio: " ", city: null });
    expect(thin.percent).toBe(70);
    expect(thin.ready).toBe(false);
    expect(thin.missing.map((m) => m.label)).toEqual(["Photo", "Bio", "City"]);
    expect(profileCompleteness({ ...full, avatarUrl: null, city: null }).ready).toBe(true); // 80%
  });
});
