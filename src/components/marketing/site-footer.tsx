import Link from "next/link";
import { SocialIcon } from "@/components/icons/social-icon";
import { APP_NAME, COMPANY_NAME, COMPANY_RC, SOCIAL_LINKS } from "@/lib/config";
import { visibleFeatures } from "@/lib/features";
import { isSparkOn } from "@/lib/spark";
import { LogoMark } from "./logo";

const COLUMN_LINK = "text-[15px] text-ink-2 transition-colors hover:text-ink";

/**
 * Footer: logo and socials on the left, Features and About columns on the right.
 */
export async function SiteFooter({ wide = false }: { wide?: boolean }) {
  const socials = SOCIAL_LINKS.filter((s) => s.url);
  const about = [
    { href: "/about", label: "About" },
    { href: "/changelog", label: "Changelog" },
    { href: "/terms", label: "Terms of use" },
    { href: "/privacy", label: "Privacy notice" },
    { href: "/community-rules", label: "Community rules" },
    { href: "/support", label: "Support" },
  ];

  return (
    <footer className="border-t border-border bg-surface text-ink">
      <div className={`mx-auto flex flex-col gap-12 py-14 sm:py-16 lg:flex-row lg:justify-between ${wide ? "max-w-[90rem] px-5 sm:px-8" : "max-w-6xl px-4 sm:px-6"}`}>
        <div className="flex flex-col gap-6">
          <a href="/home" className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark />
            <span className="text-[19px]">{APP_NAME}</span>
          </a>
          {socials.length > 0 && (
            <ul className="-ml-1.5 flex items-center gap-2" aria-label="Meetwell elsewhere">
              {socials.map((s) => (
                <li key={s.platform}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Meetwell on ${s.label}`}
                    title={s.label}
                    className="grid size-8 place-items-center text-ink-2 transition-colors hover:text-ink"
                  >
                    <SocialIcon platform={s.platform} className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-16 gap-y-10 sm:gap-x-24">
          <nav aria-label="Features" className="flex flex-col gap-3.5">
            <p className="mb-1 font-display text-2xl">Features</p>
            {visibleFeatures(await isSparkOn()).map((f) => (
              <Link key={f.slug} href={`/features/${f.slug}`} className={COLUMN_LINK}>
                {f.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="About" className="flex flex-col gap-3.5">
            <p className="mb-1 font-display text-2xl">About</p>
            {about.map((l) => (
              <Link key={l.href} href={l.href} className={COLUMN_LINK}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-4 border-t border-border py-6 text-sm text-ink-3 ${wide ? "max-w-[90rem] px-5 sm:px-8" : "max-w-6xl px-4 sm:px-6"}`}>
        <span>© {new Date().getFullYear()} {COMPANY_NAME} ({COMPANY_RC}). All rights reserved.</span>
      </div>
    </footer>
  );
}
