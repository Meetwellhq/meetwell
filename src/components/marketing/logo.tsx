import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="var(--accent)" />
      <rect x="6" y="6" width="5" height="5" rx="1.5" fill="#fff" />
      <rect x="13" y="13" width="5" height="5" rx="1.5" fill="#fff" />
      <rect x="13" y="6" width="5" height="5" rx="2.5" fill="#fff" fillOpacity="0.55" />
      <rect x="6" y="13" width="5" height="5" rx="2.5" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-ink", className)}>
      <LogoMark />
      <span className="text-[17px]">{APP_NAME}</span>
    </Link>
  );
}
