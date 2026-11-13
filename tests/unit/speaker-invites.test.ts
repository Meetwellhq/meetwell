import { describe, expect, it } from "vitest";
import { inviteSummary, parseSpeakerList } from "@/lib/speaker-invites";

describe("parseSpeakerList", () => {
  it("reads pasted lines in the usual shapes", () => {
    const { people, bad } = parseSpeakerList(
      [
        "Name, Email",
        "Ada Obi, Ada@Example.com",
        "tunde@example.com",
        "Kemi Bello <kemi@example.com>",
        "Chidi Eze\tchidi@example.com\tCTO",
        '"Okafor, Ngozi",ngozi@example.com,Founder',
        "ada@example.com",
        "Somebody without an email",
        "",
      ].join("\n"),
    );
    expect(people).toEqual([
      { name: "Ada Obi", email: "ada@example.com" },
      { name: null, email: "tunde@example.com" },
      { name: "Kemi Bello", email: "kemi@example.com" },
      { name: "Chidi Eze", email: "chidi@example.com" },
      { name: "Okafor, Ngozi", email: "ngozi@example.com" },
    ]);
    expect(bad).toEqual(["Somebody without an email"]);
  });

  it("takes the name from a column after the email too", () => {
    expect(parseSpeakerList("ada@example.com, Ada Obi\r\n").people).toEqual([{ name: "Ada Obi", email: "ada@example.com" }]);
  });
});

describe("inviteSummary", () => {
  it("says what happened in plain words", () => {
    expect(inviteSummary({ invited: 35, added: 1, already_invited: 2, bad_email: 1 })).toBe(
      "Invited 35 people · added 1 person who already had a card · 2 people were already on the list · 1 person had an email that doesn't look right",
    );
    expect(inviteSummary({ added: 2 })).toBe("Added 2 people who already had a card");
  });
});
