import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { APP_NAME } from "@/lib/config";
import { type Inline, parseChangelog } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What's new in ${APP_NAME}, newest first.`,
};

function Text({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) =>
    part.href ? (
      <a key={i} href={part.href} className="text-accent underline">
        {part.text}
      </a>
    ) : part.bold ? (
      <strong key={i} className="font-semibold text-ink">
        {part.text}
      </strong>
    ) : (
      part.text
    ),
  );
}

/** Built from CHANGELOG.md in the repo, so there is one place to write release notes. */
export default async function ChangelogPage() {
  const releases = parseChangelog(await readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8"));

  return (
    <LegalPage title="Changelog" intro={`What's new in ${APP_NAME}, newest first.`}>
      {releases.map((release) => (
        <section key={`${release.date}-${release.title}`} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
          {release.date && <p className="text-sm text-ink-3">{release.date}</p>}
          <h2>{release.title}</h2>
          <div className="space-y-3">
            {release.blocks.map((block, i) =>
              block.type === "subheading" ? (
                <h3 key={i} className="pt-1 font-semibold text-ink">
                  {block.text}
                </h3>
              ) : block.type === "paragraph" ? (
                <p key={i}>
                  <Text parts={block.content} />
                </p>
              ) : (
                <ul key={i}>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <Text parts={item} />
                    </li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </section>
      ))}
    </LegalPage>
  );
}
