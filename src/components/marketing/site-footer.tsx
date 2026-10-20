import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";
import { Logo } from "./logo";

export function SiteFooter({ bordered = true, wide = false }: { bordered?: boolean; wide?: boolean }) {
  return (
    <footer className={bordered ? "border-t border-border" : undefined}>
      <div className={`mx-auto flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between ${wide ? "max-w-[90rem] px-5 sm:px-8" : "max-w-6xl px-4 sm:px-6"}`}>
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-ink-3">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
