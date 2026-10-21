import { describe, expect, it } from "vitest";
import { inviteEmail, waitlistEmail } from "@/lib/founder-emails";

const base = { appName: "Meetwell", siteUrl: "https://meetwell.me", photoUrl: "https://meetwell.me/founder/rasheed.jpg", replyEmail: "support@meetwell.me" };

describe("waitlist email", () => {
  it("greets by first name and signs off from the founder with a photo", () => {
    const { subject, text, html } = waitlistEmail({ ...base, fullName: "  Ada Obi ", unsubscribeToken: "11111111-2222-3333-4444-555555555555" });
    expect(subject).toBe("Thanks for joining the Meetwell private beta");
    expect(text.startsWith("Hi Ada,")).toBe(true);
    expect(text).toContain("I'm so happy to have you here");
    expect(html).toContain('src="https://meetwell.me/founder/rasheed.jpg"');
    expect(html).toContain("Founder, Meetwell");
    expect(text).toContain("Drop me a line at support@meetwell.me.");
    expect(html).toContain('href="mailto:support@meetwell.me"');
  });

  it("escapes names typed into the public form", () => {
    const { html } = waitlistEmail({ ...base, fullName: '<img src=x onerror="alert(1)">', unsubscribeToken: "11111111-2222-3333-4444-555555555555" });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("invite email", () => {
  it("links to the access-code page with the code filled in", () => {
    const { subject, text, html } = inviteEmail({ ...base, fullName: "Ada Obi", code: "MW-1A2B-3C4D-5E6F" });
    expect(subject).toBe("Your Meetwell invite is ready");
    expect(text.startsWith("Hi Ada,")).toBe(true);
    expect(html).toContain('href="https://meetwell.me/access-code?code=MW-1A2B-3C4D-5E6F"');
    expect(text).toContain("Your access code: MW-1A2B-3C4D-5E6F");
    expect(html).toContain("Founder, Meetwell");
  });

  it("falls back to a friendly greeting without a name", () => {
    expect(inviteEmail({ ...base, fullName: null, code: "MW-1A2B-3C4D-5E6F" }).text.startsWith("Hi there,")).toBe(true);
  });
});

describe("reminder emails", () => {
  it("invite reminder links back to the code and promises one reminder only", async () => {
    const { inviteReminderEmail } = await import("@/lib/founder-emails");
    const { subject, text, html } = inviteReminderEmail({ ...base, fullName: "Sam Slow", code: "MW-1111-2222-3333" });
    expect(subject).toBe("Your Meetwell invite is still waiting");
    expect(text.startsWith("Hi Sam,")).toBe(true);
    expect(html).toContain('href="https://meetwell.me/access-code?code=MW-1111-2222-3333"');
    expect(text).toContain("This is the only reminder I'll send about this.");
  });

  it("draft and no-scan reminders point to the right dashboard pages", async () => {
    const { draftReminderEmail, noScansEmail } = await import("@/lib/founder-emails");
    expect(draftReminderEmail({ ...base, fullName: null }).html).toContain('href="https://meetwell.me/dashboard/profile"');
    expect(noScansEmail({ ...base, fullName: "Quinn" }).html).toContain('href="https://meetwell.me/dashboard/qr"');
  });
});

describe("waitlist updates", () => {
  it("welcome email mentions occasional updates and links to unsubscribe", () => {
    const { text, html } = waitlistEmail({ ...base, fullName: "Ada", unsubscribeToken: "11111111-2222-3333-4444-555555555555" });
    expect(text).toContain("short updates");
    expect(text).toContain("https://meetwell.me/unsubscribe?t=11111111-2222-3333-4444-555555555555");
    expect(html).toContain('href="https://meetwell.me/unsubscribe?t=11111111-2222-3333-4444-555555555555"');
  });
});

describe("match email", () => {
  it("shows the match, the reason, their QR and a link to the matches page", async () => {
    const { matchEmail } = await import("@/lib/founder-emails");
    const { subject, text, html } = matchEmail({
      ...base,
      fullName: "Tunde Bello",
      reason: "Ada has 4 years in product design (3 more than you), and is open to mentoring.",
      match: {
        fullName: "Ada Obi", title: "Senior Product Designer", organization: "Studio North", avatarUrl: null,
        cardUrl: "https://meetwell.me/p/ada",
      },
    });
    expect(subject).toBe("Spark: meet Ada Obi");
    expect(text.startsWith("Hi Tunde,")).toBe(true);
    expect(html).toContain("3 more than you");
    expect(html).not.toContain("/qr");
    expect(html).toContain('href="https://meetwell.me/p/ada"');
    expect(html).toContain('href="https://meetwell.me/dashboard/matches"');
  });
});

describe("match email photo", () => {
  const match = {
    fullName: "Ada Obi", title: null, organization: null, cardUrl: "https://meetwell.me/p/ada",
  };
  it("shows the profile photo when there is one", async () => {
    const { matchEmail } = await import("@/lib/founder-emails");
    const { html } = matchEmail({
      ...base, fullName: "Tunde", reason: "x",
      match: { ...match, avatarUrl: "https://example.supabase.co/storage/v1/object/public/avatars/u/p.jpg" },
    });
    expect(html).toContain('src="https://example.supabase.co/storage/v1/object/public/avatars/u/p.jpg"');
  });
  it("falls back to initials without a photo", async () => {
    const { matchEmail } = await import("@/lib/founder-emails");
    const { html } = matchEmail({ ...base, fullName: "Tunde", reason: "x", match: { ...match, avatarUrl: null } });
    expect(html).toContain(">AO</td>");
  });
});

describe("complete your profile email", () => {
  const args = { ...base, fullName: "Kemi Ade", completeness: 60, fieldName: "Product design" };

  it("tells experienced members without a photo why people will want to learn from them", async () => {
    const { incompleteProfileEmail } = await import("@/lib/founder-emails");
    const e = incompleteProfileEmail({ ...args, hasPhoto: false, experienceYears: 6 });
    expect(e.subject).toBe("People want to learn from you. Add your photo");
    expect(e.text).toContain("With 6 years in product design");
    expect(e.html).toContain('href="https://meetwell.me/dashboard/profile"');
  });

  it("tells members under 4 years that a photo gets them matches", async () => {
    const { incompleteProfileEmail } = await import("@/lib/founder-emails");
    for (const experienceYears of [1, null]) {
      const e = incompleteProfileEmail({ ...args, hasPhoto: false, experienceYears });
      expect(e.subject).toBe("Add a photo to get Spark introductions");
      expect(e.text).toContain("60% complete");
      expect(e.html).toContain("Add my photo");
    }
  });

  it("members with a photo get the progress version", async () => {
    const { incompleteProfileEmail } = await import("@/lib/founder-emails");
    const e = incompleteProfileEmail({ ...args, completeness: 70, hasPhoto: true, experienceYears: 6 });
    expect(e.subject).toBe("Your Meetwell profile is 70% done");
    expect(e.html).toContain('href="https://meetwell.me/dashboard/matches"');
  });
});
