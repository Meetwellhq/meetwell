/**
 * Reads the small subset of Markdown that CHANGELOG.md uses, so the public
 * /changelog page always shows the same file the repo keeps. Pure, so it can
 * be unit-tested: "## " starts a release, "- " a bullet (indented lines
 * continue it), a line that is only **bold** is a subheading, anything else is
 * a paragraph. Inline: **bold** and [text](url). Everything before the first
 * release, and "---" lines, are skipped.
 */

export type Inline = { text: string; bold?: boolean; href?: string };
export type Block =
  | { type: "subheading"; text: string }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; items: Inline[][] };
export type Release = { date: string | null; title: string; blocks: Block[] };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let current: Release | null = null;
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (!current) return;
    if (paragraph.length) {
      const text = paragraph.join(" ");
      const sub = text.match(/^\*\*([^*]+)\*\*$/);
      current.blocks.push(sub ? { type: "subheading", text: sub[1] } : { type: "paragraph", content: parseInline(text) });
    }
    if (list) current.blocks.push({ type: "list", items: list.map(parseInline) });
    paragraph = [];
    list = null;
  };

  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      const heading = line.slice(3).trim();
      const [, date, title] = heading.match(/^(\d{1,2} \w+ \d{4}):\s*(.+)$/) ?? [null, null, heading];
      current = { date, title, blocks: [] };
      releases.push(current);
    } else if (!current) {
      continue;
    } else if (line.trim() === "" || line.trim() === "---") {
      flush();
    } else if (line.startsWith("- ")) {
      if (paragraph.length) flush();
      (list ??= []).push(line.slice(2).trim());
    } else if (list && /^\s+\S/.test(line)) {
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      if (list) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return releases;
}
