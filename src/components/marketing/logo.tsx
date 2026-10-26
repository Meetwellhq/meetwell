import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/cn";

/** `inverted` draws a white tile with green squares, for use on green backgrounds. */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const [tile, mark] = inverted ? ["#fff", "var(--accent)"] : ["var(--accent)", "#fff"];
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="7" fill={tile} />
      <rect x="6" y="6" width="5" height="5" rx="1.5" fill={mark} />
      <rect x="13" y="13" width="5" height="5" rx="1.5" fill={mark} />
      <rect x="13" y="6" width="5" height="5" rx="2.5" fill={mark} fillOpacity="0.55" />
      <rect x="6" y="13" width="5" height="5" rx="2.5" fill={mark} fillOpacity="0.55" />
    </svg>
  );
}

/**
 * `large` = bigger on phones (the dashboard and admin headers), the usual size from the laptop layout up.
 * `beta` = the Beta tag (off in the admin area).
 */
export function Logo({
  href = "/home",
  className,
  large = false,
  beta = true,
}: {
  href?: string;
  className?: string;
  large?: boolean;
  beta?: boolean;
}) {
  return (
    // A plain link: /home is a redirect (dashboard if signed in, landing page otherwise).
    <a href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-ink", className)}>
      <LogoMark className={large ? "size-8 lg:size-6" : undefined} />
      <span className={large ? "text-[22px] lg:text-[17px]" : "text-[17px]"}>{APP_NAME}</span>
      {/* Remove once the product leaves beta testing. */}
      {beta && (
        <span className="rounded-full border border-accent/25 bg-accent-soft px-1.5 py-px text-[10px] font-semibold uppercase leading-4 tracking-wider text-accent">
          Beta
        </span>
      )}
    </a>
  );
}
