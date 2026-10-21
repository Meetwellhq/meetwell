import { describe, expect, it } from "vitest";
import { inviteEmail, waitlistEmail } from "@/lib/founder-emails";

const base = { appName: "Meetwell", siteUrl: "https://meetwell.me", photoUrl: "https://meetwell.me/founder/rasheed.jpg", replyEmail: "hello@meetwell.me" };

describe("waitlist email", () => {
  it("greets by first name and signs off from the founder with a photo", () => {
    const { subject, text, html } = waitlistEmail({ ...base, fullName: "  Ada Obi ", unsubscribeToken: "11111111-2222-3333-4444-555555555555" });
    expect(subject).toBe("Thanks for joining the Meetwell private beta");
    expect(text.startsWith("Hi Ada,")).toBe(true);
    expect(text).toContain("I'm so happy to have you here");
    expect(html).toContain('src="https://meetwell.me/founder/rasheed.jpg"');
    expect(html).toContain("Founder, Meetwell");
    expect(text).toContain("Drop me a line at hello@meetwell.me.");
    expect(html).toContain('href="mailto:hello@meetwell.me"');
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

describe("feature a member email", () => {
  const member = {
    fullName: "Chioma Eze",
    title: "Product Designer",
    organization: "Studio North",
    avatarUrl: null,
    cardUrl: "https://meetwell.me/p/chioma",
    qrImageUrl: "https://meetwell.me/p/chioma/qr",
  };

  it("introduces the member with their QR, card link and the founder's note", async () => {
    const { featureMemberEmail } = await import("@/lib/founder-emails");
    const { subject, text, html } = featureMemberEmail({
      ...base, fullName: "Tunde Bello", unsubscribeToken: "11111111-2222-3333-4444-555555555555", member,
      note: "Chioma designs tools for small shops in Lagos.",
    });
    expect(subject).toBe("Meet Chioma Eze on Meetwell");
    expect(text.startsWith("Hi Tunde,")).toBe(true);
    expect(html).toContain('src="https://meetwell.me/p/chioma/qr"');
    expect(html).toContain('href="https://meetwell.me/p/chioma"');
    expect(html).toContain("Chioma designs tools for small shops in Lagos.");
    expect(html).toContain("unsubscribe?t=11111111-2222-3333-4444-555555555555");
  });

  it("escapes the note so it can't inject HTML", async () => {
    const { featureMemberEmail } = await import("@/lib/founder-emails");
    const { html } = featureMemberEmail({
      ...base, fullName: null, unsubscribeToken: "11111111-2222-3333-4444-555555555555", member, note: "<script>x</script>",
    });
    expect(html).not.toContain("<script>");
  });
});
