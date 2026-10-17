import { ButtonLink } from "@/components/ui/button";
import { Logo } from "./logo";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <a href="#how-it-works" className="hidden rounded-full px-3 py-2 text-sm text-ink-2 hover:text-ink md:inline">
            How it works
          </a>
          <a href="#privacy" className="hidden rounded-full px-3 py-2 text-sm text-ink-2 hover:text-ink md:inline">
            Privacy
          </a>
          {signedIn ? (
            <ButtonLink href="/dashboard" size="sm">
              Dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" size="sm">
                Create your card
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
