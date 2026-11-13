import { describe, expect, it } from "vitest";
import { parseSpeakerSheet, readCsv, socialUrl, SPEAKER_SHEET_TEMPLATE } from "@/lib/speaker-cards";

describe("readCsv", () => {
  it("keeps quoted commas and line breaks, and reads semicolon sheets", () => {
    expect(readCsv('Name,Bio\r\n"Obi, Ada","Line one\nline two"\r\n')).toEqual([["Name", "Bio"], ["Obi, Ada", "Line one\nline two"]]);
    expect(readCsv("Name;Email\nAda;ada@x.com")).toEqual([["Name", "Email"], ["Ada", "ada@x.com"]]);
  });
});

describe("socialUrl", () => {
  it("turns handles and bare links into full links on the right site", () => {
    expect(socialUrl("x", "@adaobi")).toBe("https://x.com/adaobi");
    expect(socialUrl("x", "twitter.com/adaobi")).toBe("https://twitter.com/adaobi");
    expect(socialUrl("instagram", "ada.obi")).toBe("https://www.instagram.com/ada.obi");
    expect(socialUrl("linkedin", "linkedin.com/in/adaobi")).toBe("https://linkedin.com/in/adaobi");
    expect(socialUrl("linkedin", "http://www.linkedin.com/in/adaobi")).toBe("https://www.linkedin.com/in/adaobi");
    expect(socialUrl("linkedin", "https://evil.com/in/adaobi")).toBeNull();
  });
});

describe("parseSpeakerSheet", () => {
  it("reads the template", () => {
    const { cards, problems } = parseSpeakerSheet(SPEAKER_SHEET_TEMPLATE);
    expect(problems).toEqual([]);
    expect(cards).toEqual([
      {
        name: "Ada Obi", email: "ada@example.com", title: "Head of Product", organization: "Acme",
        bio: "Builds payments products for small businesses.", photo: null, phone: "+234 801 234 5678", whatsapp: "+234 801 234 5678",
        show_phone: true, linkedin: "https://linkedin.com/in/adaobi", x: "https://x.com/adaobi", instagram: "https://www.instagram.com/adaobi",
        facebook: null, tiktok: null, website: "https://acme.com/",
      },
    ]);
  });

  it("accepts other column names, says what it left out, and skips repeats", () => {
    const { cards, problems } = parseSpeakerSheet(
      [
        "Full Name,E-mail,Role,Organisation,Mobile,Twitter,Show phone",
        "Tunde Bello,TUNDE@x.com,Engineer,Paystack,0801 234 5678,@tunde,no",
        "Kemi,not-an-email,,,call me,https://facebook.com/kemi,",
        ",nobody@x.com,,,,,",
        "Tunde B,tunde@x.com,,,,,",
      ].join("\n"),
    );
    expect(cards.map((c) => [c.name, c.email, c.title, c.organization, c.phone, c.x, c.show_phone])).toEqual([
      ["Tunde Bello", "tunde@x.com", "Engineer", "Paystack", "0801 234 5678", "https://x.com/tunde", false],
      ["Kemi", null, null, null, null, null, false],
    ]);
    expect(problems).toEqual([
      'Kemi: "not-an-email" isn\'t an email address, so they won\'t get the email about their card.',
      'Kemi: "call me" doesn\'t look like a phone number, so it was left out.',
      'Kemi: "https://facebook.com/kemi" isn\'t a link to their X profile, so it was left out.',
      "Row 4: no name, so it was skipped.",
      "Tunde B: tunde@x.com is listed twice, so the second one was skipped.",
    ]);
  });

  it("needs a Name column", () => {
    expect(parseSpeakerSheet("Email\nada@x.com").missingName).toBe(true);
  });
});

describe("photos", () => {
  it("finds the file in Google Drive links", async () => {
    const { driveFileId } = await import("@/lib/speaker-cards");
    expect(driveFileId("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing")).toBe("1AbCdEfGhIjKlMnOp");
    expect(driveFileId("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp")).toBe("1AbCdEfGhIjKlMnOp");
    expect(driveFileId("https://drive.google.com/uc?export=view&id=1AbCdEfGhIjKlMnOp")).toBe("1AbCdEfGhIjKlMnOp");
    expect(driveFileId("https://evil.test/file/d/1AbCdEfGhIjKlMnOp/view")).toBeNull();
    expect(driveFileId("not a link")).toBeNull();
  });

  it("turns a Drive link in the sheet into an image link", () => {
    const { cards, problems } = parseSpeakerSheet("Name,Photo link\nAda,https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing");
    expect(problems).toEqual([]);
    expect(cards[0].photo).toBe("https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w1000");
  });

  it("matches photo files to speakers by name or email", async () => {
    const { matchPhotos } = await import("@/lib/speaker-cards");
    const cards = [
      { name: "Ada Obi", email: "ada@x.com" },
      { name: "Tunde Bello", email: "tbello@x.com" },
      { name: "Kemi Adeyemi", email: null },
    ];
    const { matches, unmatched } = matchPhotos(["ADA_OBI.JPG", "tbello.png", "kemi-adeyemi.webp", "random.jpg", "Ada Obi (2).jpg"], cards);
    expect([...matches.entries()]).toEqual([[0, 0], [1, 1], [2, 2]]);
    expect(unmatched).toEqual(["random.jpg", "Ada Obi (2).jpg"]);
  });
});
