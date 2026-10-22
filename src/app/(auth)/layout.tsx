import Link from "next/link";
import { LogoMark } from "@/components/marketing/logo";
import { Alert } from "@/components/ui/misc";
import { APP_NAME, COMPANY_NAME, isSupabaseConfigured } from "@/lib/config";

const COLUMN = "mx-auto w-full max-w-[36rem] border-x border-border";

/**
 * Auth pages sit in one narrow column framed by hairline guides; each page is
 * a stack of bands (AuthSection) separated by full-width lines.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <div className="h-11 shrink-0 border-b border-border">
        <div className={`${COLUMN} h-full`} />
      </div>
      <main className={`${COLUMN} flex flex-1 flex-col`}>
        {/* A plain link: /home goes to the dashboard if signed in, the landing page otherwise. */}
        <a href="/home" className="flex flex-col items-center gap-4 px-6 py-12">
          <LogoMark className="size-16 drop-shadow-sm" />
          <span className="text-3xl font-semibold tracking-tight text-ink">{APP_NAME}</span>
        </a>
        {!isSupabaseConfigured() && (
          <div className="border-t border-border px-6 py-4 sm:px-8">
            <Alert tone="danger">
              Supabase isn&apos;t configured yet. Add your project keys to <code>.env.local</code> (see the README).
            </Alert>
          </div>
        )}
        <div className="divide-y divide-border border-y border-border">{children}</div>
        <footer className="px-6 py-6 text-center text-sm text-ink-3">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            Privacy policy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
            Terms of service
          </Link>
          <p className="mt-2 text-xs">
            © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
