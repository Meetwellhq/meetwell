import { visibleFeatures } from "@/lib/features";
import { isSparkOn } from "@/lib/spark";
import { Logo } from "./logo";
import { SiteNav } from "./site-nav";

/** Header for the public pages: logo, menus and buttons (after Calendly's). */
export async function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const features = visibleFeatures(await isSparkOn()).map(({ slug, name, title }) => ({ slug, name, title }));
  // Solid, no backdrop blur: a blur would trap the phone menu panel (position: fixed) inside the header.
  return (
    <header className="sticky top-0 z-40 bg-surface">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center px-4 sm:px-8">
        <Logo />
        <SiteNav signedIn={signedIn} features={features} />
      </div>
    </header>
  );
}
