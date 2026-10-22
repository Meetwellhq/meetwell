import { Mail } from "lucide-react";
import Link from "next/link";
import { SocialIcon } from "@/components/icons/social-icon";
import { COMPANY_NAME, COMPANY_RC, SOCIAL_LINKS, SUPPORT_EMAIL } from "@/lib/config";
import { Logo } from "./logo";

const ICON_LINK =
  "grid size-9 place-items-center rounded-full border border-border text-ink-2 transition-colors hover:border-border-strong hover:text-ink";

export function SiteFooter({ bordered = true, wide = false }: { bordered?: boolean; wide?: boolean }) {
  const socials = SOCIAL_LINKS.filter((s) => s.url);
  return (
    <footer className={bordered ? "border-t border-border" : undefined}>
      <div className={`mx-auto flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between ${wide ? "max-w-[90rem] px-5 sm:px-8" : "max-w-6xl px-4 sm:px-6"}`}>
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-ink-3">
            © {new Date().getFullYear()} {COMPANY_NAME} ({COMPANY_RC}). All rights reserved.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <ul className="flex items-center gap-2" aria-label="Meetwell elsewhere">
            {socials.map((s) => (
              <li key={s.platform}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Meetwell on ${s.label}`} title={s.label} className={ICON_LINK}>
                  <SocialIcon platform={s.platform} className="size-4" />
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} aria-label={`Email ${SUPPORT_EMAIL}`} title={SUPPORT_EMAIL} className={ICON_LINK}>
                <Mail className="size-4" aria-hidden />
              </a>
            </li>
          </ul>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/changelog" className="hover:text-ink">
              Changelog
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink">
              {SUPPORT_EMAIL}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
