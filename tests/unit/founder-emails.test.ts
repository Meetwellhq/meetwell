import { describe, expect, it } from "vitest";
import { inviteEmail, mentoringEmail, newMessageEmail, partnerAccessEmail, sparkBetaEmail, sparkPausedEmail, waitlistEmail } from "@/lib/founder-emails";

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
    expect(e.text).toContain("people earlier in their careers who want to learn from you"); // 4+ years: recommended
    const junior = incompleteProfileEmail({ ...args, completeness: 70, hasPhoto: true, experienceYears: 2 });
    expect(junior.text).toContain("one a month");
  });
});

describe("Spark beta announcement", () => {
  it("explains Spark and links to the Spark page", () => {
    const { subject, text, html } = sparkBetaEmail({ ...base, fullName: "Ada Obi" });
    expect(subject).toBe("Come and try Spark, our new beta feature");
    expect(text.startsWith("Hi Ada,")).toBe(true);
    expect(text).toContain("one free introduction a month");
    expect(html).toContain('href="https://meetwell.me/dashboard/matches"');
    expect(html).toContain('href="mailto:support@meetwell.me"');
    expect(text).toContain("one-off note");
  });
});

describe("mentoring announcement", () => {
  it("asks for years of experience and explains both sides, including how mentors earn", () => {
    const { subject, text, html } = mentoringEmail({ ...base, fullName: "Ada Obi" });
    expect(subject).toBe("Mentoring is open on Meetwell");
    expect(text.startsWith("Hi Ada,")).toBe(true);
    expect(html).toContain('href="https://meetwell.me/dashboard/profile"');
    expect(html).toContain("<strong>4 years or more?</strong>");
    expect(text).toContain("You keep 80% of every payment");
    expect(text).not.toContain("<strong>");
    expect(text).toContain("one-off note");
  });
});

describe("partner access email", () => {
  it("names the partner, links to its page and explains the 10%", () => {
    const { subject, text, html } = partnerAccessEmail({ ...base, fullName: null, partnerName: "ThinkUX" });
    expect(subject).toBe("You can now see ThinkUX on Meetwell");
    expect(text.startsWith("Hi there,")).toBe(true);
    expect(html).toContain('href="https://meetwell.me/dashboard/partner"');
    expect(text).toContain("10% of it for their first 12 months");
  });
});

describe("Spark paused email", () => {
  it("explains the pause, the 5,000 goal, refunds and links to the QR page", () => {
    const { subject, text, html } = sparkPausedEmail({ ...base, fullName: "Ada Obi" });
    expect(subject).toBe("Spark is taking a break until Meetwell has 5,000 members");
    expect(text.startsWith("Hi Ada,")).toBe(true);
    expect(text).toContain("about as many mentors as mentees");
    expect(text).toContain("refund");
    expect(html).toContain('href="https://meetwell.me/dashboard/qr"');
  });
});

describe("new message email", () => {
  it("shows the sender and a preview like LinkedIn, links to the chat, escapes text, and can be turned off", () => {
    const { subject, text, html } = newMessageEmail({
      ...base, fullName: "Ada Obi", senderName: "Tunde <b>", senderTitle: "Product Designer · Kuda", senderAvatar: null,
      preview: "Hi Ada <script>", conversationId: 42, offToken: "11111111-2222-3333-4444-555555555555",
    });
    expect(subject).toBe("Tunde <b> sent you a message");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Hi Ada &lt;script&gt;");
    expect(html).toContain("Product Designer · Kuda");
    expect(html).toContain(">T<"); // initials if no photo, symbols ignored
    expect(text).toContain("message emails are on");
    expect(html).not.toContain("Tunde <b>"); // escaped in the email body
    expect(html).toContain('href="https://meetwell.me/dashboard/messages/42"');
    expect(text).toContain("https://meetwell.me/unsubscribe/messages?t=11111111-2222-3333-4444-555555555555");
    expect(html).toContain("Turn off message emails");
  });
});

describe("mentor emails", () => {
  it("approval links to the Mentoring page and mentions the 7-day reply rule", async () => {
    const { mentorApprovedEmail } = await import("@/lib/founder-emails");
    const e = mentorApprovedEmail({ ...base, fullName: "Ada Obi" });
    expect(e.subject).toBe("You're a Meetwell mentor now");
    expect(e.html).toContain('href="https://meetwell.me/dashboard/mentor"');
    expect(e.text).toContain("within 7 days");
  });

  it("withdrawal email names the amount and bank", async () => {
    const { withdrawalSentEmail } = await import("@/lib/founder-emails");
    const e = withdrawalSentEmail({ ...base, fullName: "Ada Obi", amount: "₦9,600", bank: "GTBank" });
    expect(e.subject).toBe("₦9,600 is on its way to you");
    expect(e.text).toContain("GTBank");
  });

  it("renewal reminder links to the mentor's subscribe page and says nothing renews by itself", async () => {
    const { renewalReminderEmail } = await import("@/lib/founder-emails");
    const e = renewalReminderEmail({ ...base, fullName: "Tunde Bello", mentorName: "Ada Obi", mentorSlug: "ada", endsOn: "24 October" });
    expect(e.subject).toBe("Your messages with Ada end on 24 October");
    expect(e.html).toContain('href="https://meetwell.me/subscribe/ada"');
    expect(e.text).toContain("won't be charged unless you choose to");
  });
});

describe("message email sender line", () => {
  it("keeps every letter of the sender's name", async () => {
    const { newMessageEmail } = await import("@/lib/founder-emails");
    const e = newMessageEmail({
      ...base, fullName: "Ada", senderName: "Abdur-rasheed Idris", senderTitle: null, senderAvatar: null,
      preview: "Hello", conversationId: 1, offToken: "11111111-2222-3333-4444-555555555555",
    });
    expect(e.subject).toBe("Abdur-rasheed Idris sent you a message");
  });
});

describe("messageFromLine", () => {
  it("names the sender via Meetwell and keeps the header safe", async () => {
    const { messageFromLine } = await import("@/lib/founder-emails");
    expect(messageFromLine("Abdur-rasheed Idris", "Meetwell")).toBe('"Abdur-rasheed Idris via Meetwell" <messages-noreply@meetwell.me>');
    expect(messageFromLine('Bad "Name" <x@y>\nNext', "Meetwell")).toBe('"Bad Name x@y Next via Meetwell" <messages-noreply@meetwell.me>');
    expect(messageFromLine("   ", "Meetwell")).toBe('"A Meetwell member via Meetwell" <messages-noreply@meetwell.me>');
  });
});

describe("reply reminder email", () => {
  it("says who is waiting, and reminds mentors about the 7-day refund", async () => {
    const { newMessageEmail } = await import("@/lib/founder-emails");
    const args = {
      ...base, fullName: "Ada Obi", senderName: "Tunde Bello", senderTitle: null, senderAvatar: null,
      preview: "Are you free this week?", conversationId: 7, offToken: "11111111-2222-3333-4444-555555555555", reminder: true,
    };
    const mentor = newMessageEmail({ ...args, toMentor: true });
    expect(mentor.subject).toBe("Tunde is waiting for your reply");
    expect(mentor.html).toContain("Hi Ada, Tunde is waiting for your reply.");
    expect(mentor.text).toContain("within 7 days of paying get a full refund");
    const member = newMessageEmail({ ...args, toMentor: false });
    expect(member.text).not.toContain("refund");
  });
});

describe("logo in emails", () => {
  it("puts the Meetwell logo at the top of founder and message emails", async () => {
    const { waitlistEmail, newMessageEmail } = await import("@/lib/founder-emails");
    const logo = 'src="https://meetwell.me/email/logo.png"';
    expect(waitlistEmail({ ...base, fullName: "Ada", unsubscribeToken: "11111111-2222-3333-4444-555555555555" }).html).toContain(logo);
    expect(
      newMessageEmail({
        ...base, fullName: "Ada", senderName: "Tunde", senderTitle: null, senderAvatar: null,
        preview: "Hi", conversationId: 1, offToken: "11111111-2222-3333-4444-555555555555",
      }).html,
    ).toContain(logo);
  });
});
