import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { APP_NAME, isSupabaseConfigured } from "@/lib/config";
import { type Block, type Inline, parseChangelog, type Release, releaseId, releaseMonth, shortDate } from "@/lib/changelog";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What's new in ${APP_NAME}, newest first.`,
};

async function isSignedIn() {
  if (!isSupabaseConfigured()) return false;
  try {
    return !!(await getCurrentUser());
  } catch {
    return false;
  }
}

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

function Blocks({ blocks }: { blocks: Block[] }) {
  return blocks.map((block, i) =>
    block.type === "subheading" ? (
      <h3 key={i} className="pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
        {block.text}
      </h3>
    ) : block.type === "paragraph" ? (
      <p key={i} className="text-[17px] leading-relaxed text-ink-2">
        <Text parts={block.content} />
      </p>
    ) : (
      <ul key={i} className="flex flex-col gap-4 border-l border-border pl-6">
        {block.items.map((item, j) => (
          <li key={j} className="text-[16px] leading-relaxed text-ink-2">
            <Text parts={item} />
          </li>
        ))}
      </ul>
    ),
  );
}

/** Releases grouped by month, newest first, for the sidebar. */
function byMonth(releases: Release[]) {
  const months: { month: string; releases: Release[] }[] = [];
  for (const r of releases) {
    const month = releaseMonth(r.date);
    const last = months.at(-1);
    if (last?.month === month) last.releases.push(r);
    else months.push({ month, releases: [r] });
  }
  return months;
}

/** Built from CHANGELOG.md in the repo, so there is one place to write release notes. */
export default async function ChangelogPage() {
  const [releases, signedIn] = await Promise.all([
    readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8").then(parseChangelog),
    isSignedIn(),
  ]);
  const months = byMonth(releases);

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <h1 className="font-display text-4xl leading-none tracking-tight text-ink sm:text-5xl">Changelog</h1>
        <p className="mt-4 text-lg text-ink-2">What&apos;s new in {APP_NAME}, newest first.</p>

        <div className="mt-14 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20">
          {/* Sidebar: months, then each release. */}
          <nav aria-label="Releases" className="hidden lg:block">
            <div className="sticky top-24 flex flex-col gap-5">
              {months.map((m, mi) => (
                <div key={m.month}>
                  <p className={mi === 0 ? "font-semibold text-ink" : "font-semibold text-ink-2"}>{m.month}</p>
                  <ul className="ml-3 mt-3 flex flex-col border-l border-border">
                    {m.releases.map((r) => {
                      const latest = r === releases[0];
                      return (
                        <li key={releaseId(r)}>
                          <a
                            href={`#${releaseId(r)}`}
                            className={`-ml-px block border-l py-1.5 pl-4 text-sm transition-colors ${
                              latest ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"
                            }`}
                          >
                            <span className="tabular-nums">{shortDate(r.date)}</span>
                            <span className="block truncate">{r.title}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          {/* Releases */}
          <div className="flex flex-col">
            {releases.map((r, i) => (
              <article
                key={releaseId(r)}
                id={releaseId(r)}
                className="scroll-mt-24 border-t border-border py-12 first:border-t-0 first:pt-0"
              >
                <p className="flex items-center gap-2.5 text-sm text-ink-3">
                  {r.date}
                  {i === 0 && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">Latest</span>}
                </p>
                <h2 className="mt-3 font-display text-3xl leading-[1.05] tracking-tight text-ink">{r.title}</h2>
                <div className="mt-6 flex flex-col gap-5">
                  <Blocks blocks={r.blocks} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter wide />
    </div>
  );
}
