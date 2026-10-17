import { describe, expect, it } from "vitest";
import { toPreview, toFormValues } from "@/components/editor/types";
import { contactActions, mailtoWithBody } from "@/lib/profiles/links";
import { toPublicView, type OwnProfile } from "@/lib/profiles/types";
import { templateStarters } from "@/lib/starters/templates";
import { STARTER_INTENTS } from "@/lib/starters/types";
import { normalizePhone, normalizeWebUrl, profileInputSchema, slugify, urlMatchesPlatform } from "@/lib/validation";
import { buildVCard, escapeVCardValue, foldLine, vCardFileName } from "@/lib/vcard";

const baseInput = {
  slug: "amara-okafor",
  fullName: "Amara Okafor",
  avatarUrl: null,
  title: "Product Designer",
  organization: "Studio North",
  bio: "",
  websiteUrl: "amara.design",
  websiteIsPublic: true,
  networkingGoals: ["collaborators"],
  contacts: [{ type: "email", value: " Amara@Example.COM ", label: "", isPublic: true }],
  socials: [{ platform: "github", url: "github.com/amara", isPublic: true }],
};

describe("URL validation", () => {
  it("adds https and normalises", () => {
    expect(normalizeWebUrl("example.com")).toBe("https://example.com/");
    expect(normalizeWebUrl("http://example.com/a")).toBe("http://example.com/a");
  });
  it("rejects unsafe or malformed URLs", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "https://user:pw@x.com", "localhost", "not a url", "vbscript:x"]) {
      expect(normalizeWebUrl(bad), bad).toBeNull();
    }
    expect(normalizeWebUrl("http://x.com", { httpsOnly: true })).toBeNull();
  });
  it("checks social hosts", () => {
    expect(urlMatchesPlatform("https://www.linkedin.com/in/a", "linkedin")).toBe(true);
    expect(urlMatchesPlatform("https://evil.com/linkedin.com", "linkedin")).toBe(false);
    expect(urlMatchesPlatform("https://notgithub.com/a", "github")).toBe(false);
    expect(urlMatchesPlatform("https://anything.dev", "other")).toBe(true);
  });
});

describe("phone and slug", () => {
  it("normalises phones", () => {
    expect(normalizePhone("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
  });
  it("slugifies names", () => {
    expect(slugify("Zoë  O'Brien-Smith")).toBe("zoe-o-brien-smith");
    expect(slugify("---")).toBe("");
  });
});

describe("profile schema", () => {
  it("accepts and normalises a valid profile", () => {
    const r = profileInputSchema.parse(baseInput);
    expect(r.contacts[0].value).toBe("amara@example.com");
    expect(r.socials[0].url).toBe("https://github.com/amara");
    expect(r.websiteUrl).toBe("https://amara.design/");
    expect(r.bio).toBeNull();
  });
  it("requires a country code for WhatsApp", () => {
    const wa = (value: string) =>
      profileInputSchema.safeParse({ ...baseInput, contacts: [{ type: "whatsapp", value, label: "", isPublic: true }] });
    expect(wa("0803 123 4567").success).toBe(false);
    expect(wa("+234 803 123 4567").data?.contacts[0].value).toBe("+2348031234567");
    expect(wa("00234 803 123 4567").data?.contacts[0].value).toBe("+2348031234567");
  });
  it("does not require a phone number", () => {
    expect(profileInputSchema.safeParse({ ...baseInput, contacts: [] }).success).toBe(true);
  });
  it("reports field-level errors", () => {
    const r = profileInputSchema.safeParse({
      ...baseInput,
      slug: "admin",
      fullName: " ",
      contacts: [{ type: "email", value: "nope", label: "", isPublic: true }],
      socials: [{ platform: "linkedin", url: "https://github.com/x", isPublic: true }],
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["slug", "fullName", "contacts.0.value", "socials.0.url"]));
  });
  it("only accepts avatars from our storage bucket", () => {
    expect(profileInputSchema.safeParse({ ...baseInput, avatarUrl: "https://evil.com/a.jpg" }).success).toBe(false);
    expect(
      profileInputSchema.safeParse({ ...baseInput, avatarUrl: "https://proj.supabase.co/storage/v1/object/public/avatars/u/1.jpg" }).success,
    ).toBe(true);
  });
  it("allows only one networking goal", () => {
    expect(profileInputSchema.safeParse({ ...baseInput, networkingGoals: ["clients"] }).success).toBe(true);
    expect(profileInputSchema.safeParse({ ...baseInput, networkingGoals: [] }).success).toBe(true);
    expect(profileInputSchema.safeParse({ ...baseInput, networkingGoals: ["clients", "mentors"] }).success).toBe(false);
  });
  it("rejects unknown goals and platforms", () => {
    expect(profileInputSchema.safeParse({ ...baseInput, networkingGoals: ["world-domination"] }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...baseInput, socials: [{ platform: "myspace", url: "https://myspace.com", isPublic: true }] }).success).toBe(false);
  });
});

const own: OwnProfile = {
  id: "p1",
  slug: "amara",
  fullName: "Amara Okafor",
  avatarUrl: null,
  title: "Designer",
  organization: null,
  bio: null,
  websiteUrl: "https://private.example/",
  websiteIsPublic: false,
  networkingGoals: [],
  status: "published",
  publishedAt: "2026-01-01",
  updatedAt: "2026-01-01",
  contacts: [
    { type: "email", value: "a@x.test", label: null, isPublic: true },
    { type: "phone", value: "+15550001111", label: null, isPublic: false },
  ],
  socials: [
    { platform: "github", url: "https://github.com/a", isPublic: true },
    { platform: "x", url: "https://x.com/hidden", isPublic: false },
  ],
};

describe("privacy projection", () => {
  it("toPublicView and the editor preview drop private fields", () => {
    for (const view of [toPublicView(own), toPreview(toFormValues(own, null))]) {
      const json = JSON.stringify(view);
      expect(json).not.toContain("+15550001111");
      expect(json).not.toContain("x.com/hidden");
      expect(json).not.toContain("private.example");
      expect(json).not.toContain("p1");
    }
  });
});

describe("vCard", () => {
  it("escapes and folds per spec", () => {
    expect(escapeVCardValue("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const folded = foldLine("NOTE:" + "é".repeat(60));
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it("builds a valid card with only the given fields", () => {
    const v = buildVCard({ ...toPublicView(own), profileUrl: "https://app.test/p/amara" });
    expect(v.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(v.endsWith("END:VCARD\r\n")).toBe(true);
    expect(v).toContain("FN:Amara Okafor");
    expect(v).toContain("N:Okafor;Amara;;;");
    expect(v).toContain("EMAIL;TYPE=INTERNET:a@x.test");
    expect(v).toContain("X-SOCIALPROFILE;TYPE=github:https://github.com/a");
    expect(v).not.toContain("+15550001111");
    expect(v).not.toContain("private.example");
  });
  it("makes safe filenames", () => {
    expect(vCardFileName('Amara "O" Okafor/../')).toBe("amara-o-okafor.vcf");
  });
});

describe("conversation starters", () => {
  const profile = { fullName: "Amara Okafor", title: "Product Designer", organization: "Studio North", networkingGoals: ["collaborators", "mentees"] as const };
  const sparse = { fullName: "Lee", title: null, organization: null, networkingGoals: [] };

  it("produces several clean drafts for every intent, with and without profile data", () => {
    for (const { value } of STARTER_INTENTS) {
      for (const p of [{ ...profile, networkingGoals: [...profile.networkingGoals] }, sparse]) {
        const drafts = templateStarters(value, p);
        expect(drafts.length).toBeGreaterThanOrEqual(3);
        for (const d of drafts) {
          expect(d.startsWith(`Hi ${p.fullName.split(" ")[0]}`) || d.startsWith(`Hey ${p.fullName.split(" ")[0]}`)).toBe(true);
          expect(d).not.toMatch(/undefined|null|\s{2}|\s[.,!?]/);
          expect(d.length).toBeLessThan(400);
        }
      }
    }
  });

  it("uses profile context", () => {
    const [d] = templateStarters("collaborate", { ...profile, networkingGoals: ["collaborators"] });
    expect(d).toContain("Product Designer at Studio North");
    expect(d).toContain("open to collaborators");
  });

  it("never claims a meeting unless the visitor chose follow-up", () => {
    for (const { value } of STARTER_INTENTS) {
      if (value === "follow_up") continue;
      for (const d of templateStarters(value, { ...profile, networkingGoals: [...profile.networkingGoals] })) {
        expect(d).not.toMatch(/\bmet\b|meeting you|we spoke|our conversation|last week|at the event/i);
      }
    }
  });
});

describe("contact actions", () => {
  it("builds tap targets", () => {
    const actions = contactActions({
      contacts: [
        { type: "email", value: "a@x.test", label: null },
        { type: "phone", value: "+15550001111", label: "Work" },
        { type: "whatsapp", value: "+447700900000", label: null },
      ],
      websiteUrl: "https://a.dev/",
    });
    expect(actions.map((a) => a.href)).toEqual([
      "mailto:a@x.test",
      "tel:+15550001111",
      "sms:+15550001111",
      "https://wa.me/447700900000",
      "https://a.dev/",
    ]);
    expect(mailtoWithBody("a@x.test", "Hi there", "Line & more")).toBe("mailto:a@x.test?subject=Hi%20there&body=Line%20%26%20more");
  });
});
