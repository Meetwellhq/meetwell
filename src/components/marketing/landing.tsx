import { Check, ScanLine } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A rounded cream "sheet" sitting on the sand page background. */
export function Panel({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-20 rounded-[2rem] border border-border bg-white px-5 py-14 sm:px-10 sm:py-20 lg:px-16", className)}>
      {children}
    </section>
  );
}

/** Small label pill shown above feature headings. */
export function Pill({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        tone === "dark" ? "bg-ink text-white" : "border border-border bg-white text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

/** Two-column feature: copy on one side, a bold rounded visual on the other. */
export function Feature({
  label,
  title,
  body,
  action,
  visual,
  visualClassName,
  reverse,
}: {
  label: string;
  title: ReactNode;
  body: ReactNode;
  action?: ReactNode;
  visual: ReactNode;
  visualClassName: string;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(reverse && "lg:order-2")}>
        <Pill>{label}</Pill>
        <h2 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">{title}</h2>
        <div className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-2">{body}</div>
        {action && <div className="mt-8">{action}</div>}
      </div>
      <div
        className={cn(
          "relative flex min-h-[22rem] items-center justify-center overflow-hidden rounded-[1.75rem] p-6 sm:min-h-[28rem] sm:p-10",
          visualClassName,
          reverse && "lg:order-1",
        )}
      >
        {visual}
      </div>
    </div>
  );
}

/** Honest, product-fact highlights in a gently scrolling strip. */
export function HighlightsStrip({ items }: { items: string[] }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-ink-2">
          <Check className="size-4 text-accent" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** A phone camera framing the QR code. */
export function ScanVisual({ qrSvg }: { qrSvg: string }) {
  return (
    <div className="relative w-56 sm:w-64">
      <div className="rounded-[2.25rem] border-[6px] border-ink bg-ink p-1.5 shadow-2xl">
        <div className="rounded-[1.75rem] bg-[#1b1b1a] px-5 pb-8 pt-10">
          <div className="relative rounded-2xl bg-white p-3">
            {/* viewfinder corners */}
            <span className="absolute -left-2 -top-2 size-6 rounded-tl-xl border-l-4 border-t-4 border-[#75e0a7]" />
            <span className="absolute -right-2 -top-2 size-6 rounded-tr-xl border-r-4 border-t-4 border-[#75e0a7]" />
            <span className="absolute -bottom-2 -left-2 size-6 rounded-bl-xl border-b-4 border-l-4 border-[#75e0a7]" />
            <span className="absolute -bottom-2 -right-2 size-6 rounded-br-xl border-b-4 border-r-4 border-[#75e0a7]" />
            <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-2 text-[11px] font-medium text-white">
            <ScanLine className="size-4" aria-hidden />
            Open card on meetwell.me
          </p>
        </div>
      </div>
    </div>
  );
}
