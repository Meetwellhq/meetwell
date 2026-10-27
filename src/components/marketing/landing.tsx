import { ScanLine, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A rounded cream "sheet" sitting on the sand page background. */
export function Panel({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-20 rounded-[1.5rem] bg-surface px-5 py-14 sm:px-10 sm:py-20 lg:px-16", className)}>
      {children}
    </section>
  );
}

/** Two-column feature: copy on one side, a bold rounded visual on the other. */
export function Feature({
  title,
  body,
  action,
  visual,
  visualClassName,
  reverse,
}: {
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
        <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">{title}</h2>
        <div className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-2">{body}</div>
        {action && <div className="mt-8">{action}</div>}
      </div>
      <div
        className={cn(
          "relative flex min-h-[22rem] items-center justify-center overflow-hidden rounded-[1.25rem] p-6 sm:min-h-[28rem] sm:p-10",
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
export function HighlightsStrip({ items }: { items: { icon: LucideIcon; label: string }[] }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-2 whitespace-nowrap rounded-full bg-accent-soft px-3.5 py-2 text-sm font-medium text-accent"
        >
          <Icon className="size-4" aria-hidden />
          {label}
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
      <div className="rounded-[2.25rem] border-[6px] border-[#141413] bg-[#141413] p-1.5 shadow-2xl">
        <div className="rounded-[1.75rem] bg-[#1b1b1a] px-5 pb-8 pt-10">
          <div className="relative rounded-2xl bg-surface p-3">
            {/* viewfinder corners */}
            <span className="absolute -left-2 -top-2 size-6 rounded-tl-xl border-l-4 border-t-4 border-[#75e0a7]" />
            <span className="absolute -right-2 -top-2 size-6 rounded-tr-xl border-r-4 border-t-4 border-[#75e0a7]" />
            <span className="absolute -bottom-2 -left-2 size-6 rounded-bl-xl border-b-4 border-l-4 border-[#75e0a7]" />
            <span className="absolute -bottom-2 -right-2 size-6 rounded-br-xl border-b-4 border-r-4 border-[#75e0a7]" />
            <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-surface/10 px-3 py-2 text-[11px] font-medium text-white">
            <ScanLine className="size-4" aria-hidden />
            Open card on meetwell.me
          </p>
        </div>
      </div>
    </div>
  );
}

type Step = { icon: LucideIcon; text: string };

/**
 * Before, during and after you meet (after Calendly's stacked step cards): each
 * moment with a short checklist and a small picture of what happens.
 */
export function Journey({
  moments,
}: {
  moments: { title: string; body: string; steps: Step[]; visual: ReactNode; tint: string }[];
}) {
  // Each card sticks a little lower than the one before, so as you scroll they
  // stack like a deck (each earlier card's top edge peeks out above the next).
  return (
    <ol className="flex flex-col gap-8 pb-8">
      {moments.map((m, i) => (
        <li
          key={m.title}
          style={{ top: `calc(5.5rem + ${i} * 1.75rem)` }}
          className="sticky grid min-h-[26rem] items-center gap-8 rounded-[1.25rem] border border-border bg-surface p-6 shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.15)] sm:p-10 lg:grid-cols-[1fr_26rem] lg:gap-14"
        >
          <div>
            <p className="text-sm font-medium text-accent">Step {i + 1}</p>
            <h3 className="mt-1 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">{m.title}</h3>
            <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-ink-2">{m.body}</p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {m.steps.map((s) => (
                <li key={s.text} className="flex items-center gap-3 text-[15px] text-ink">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <s.icon className="size-4" aria-hidden />
                  </span>
                  {s.text}
                </li>
              ))}
            </ul>
          </div>
          <div className={cn("flex min-h-64 items-center justify-center rounded-[1rem] p-6 sm:min-h-72", m.tint)} aria-hidden>
            {m.visual}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Things that happen on Meetwell, drifting by on the closing banner. */
export function MomentsStrip({ items }: { items: string[] }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {items.map((label) => (
        <li key={label} className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white">
          <span className="size-1.5 rounded-full bg-[#75e0a7]" aria-hidden />
          {label}
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
