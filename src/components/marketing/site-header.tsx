import { ButtonLink } from "@/components/ui/button";
import { Logo } from "./logo";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-4 sm:px-8">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {signedIn ? (
            <ButtonLink href="/dashboard" size="sm">
              Dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="secondary" size="sm" className="max-sm:px-2.5!">
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" size="sm">
                <span className="sm:hidden">Sign up</span>
                <span className="hidden sm:inline">Create your card</span>
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
