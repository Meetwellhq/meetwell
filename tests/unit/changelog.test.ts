import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChangelog, parseInline } from "@/lib/changelog";

describe("parseInline", () => {
  it("handles bold and links", () => {
    expect(parseInline("Live at [meetwell.me](https://meetwell.me), **free**.")).toEqual([
      { text: "Live at " },
      { text: "meetwell.me", href: "https://meetwell.me" },
      { text: ", " },
      { text: "free", bold: true },
      { text: "." },
    ]);
  });
});

describe("parseChangelog", () => {
  it("splits releases, subheadings, paragraphs and wrapped bullets", () => {
    const md = [
      "# Title", "", "Intro is skipped.", "", "---", "",
      "## 21 October 2026: Meet Spark", "", "**Spark** helps you.", "", "**How it works**",
      "- First line", "  continues here.", "- Second", "", "## Later notes", "- One",
    ].join("\r\n");
    expect(parseChangelog(md)).toEqual([
      {
        date: "21 October 2026",
        title: "Meet Spark",
        blocks: [
          { type: "paragraph", content: [{ text: "Spark", bold: true }, { text: " helps you." }] },
          { type: "subheading", text: "How it works" },
          { type: "list", items: [[{ text: "First line continues here." }], [{ text: "Second" }]] },
        ],
      },
      { date: null, title: "Later notes", blocks: [{ type: "list", items: [[{ text: "One" }]] }] },
    ]);
  });

  it("reads the real CHANGELOG.md, every release dated, newest first", () => {
    const releases = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
    expect(releases.length).toBeGreaterThan(3);
    expect(releases.every((r) => r.date && r.blocks.length > 0)).toBe(true);
    expect(releases.at(-1)!.title).toBe("Meetwell is born");
  });
});
