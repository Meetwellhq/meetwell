import { describe, expect, it } from "vitest";
import { inviteEmail, waitlistEmail } from "@/lib/founder-emails";

const base = { appName: "Meetwell", siteUrl: "https://meetwell.me", photoUrl: "https://meetwell.me/founder/rasheed.jpg", replyEmail: "hello@meetwell.me" };

describe("waitlist email", () => {
  it("greets by first name and signs off from the founder with a photo", () => {
    const { subject, text, html } = waitlistEmail({ ...base, fullName: "  Ada Obi " });
    expect(subject).toBe("Thanks for joining the Meetwell private beta");
    expect(text.startsWith("Hi Ada,")).toBe(true);
    expect(text).toContain("I'm so happy to have you here");
    expect(html).toContain('src="https://meetwell.me/founder/rasheed.jpg"');
    expect(html).toContain("Founder, Meetwell");
    expect(text).toContain("Drop me a line at hello@meetwell.me.");
    expect(html).toContain('href="mailto:hello@meetwell.me"');
  });

  it("escapes names typed into the public form", () => {
    const { html } = waitlistEmail({ ...base, fullName: '<img src=x onerror="alert(1)">' });
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
