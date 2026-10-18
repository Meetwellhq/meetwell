import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** One band of the auth card; the layout draws the dividing lines between bands. */
export function AuthSection({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("px-6 py-7 sm:px-8", className)}>{children}</section>;
}

/** The title band at the top of an auth page. */
export function AuthIntro({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <AuthSection>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {children && <p className="mt-2 leading-relaxed text-ink-2">{children}</p>}
    </AuthSection>
  );
}

/** Full-width buttons used for every action in the auth card (standard 8px corners). */
export const AUTH_BUTTON = "h-12 w-full text-base";
