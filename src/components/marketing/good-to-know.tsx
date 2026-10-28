"use client";

import { CirclePlus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * "Good to know" on feature pages: one card open at a time. The open card is wide and brand green
 * with its number, title and detail; the others are narrow white cards (number, title and a plus)
 * that open when clicked. Side by side from tablets up, stacked on phones.
 */
export function GoodToKnow({ items }: { items: { title: string; body: string }[] }) {
  const [open, setOpen] = useState(0);

  return (
    <ol className="flex flex-col gap-3 sm:h-[22rem] sm:flex-row">
      {items.map((item, i) => {
        const on = i === open;
        return (
          <li
            key={item.title}
            className={cn(
              "min-w-0 rounded-xl transition-[flex-grow,background-color] duration-500 ease-out",
              on ? "bg-accent text-white sm:flex-[2.2]" : "bg-surface text-ink sm:flex-1",
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-expanded={on}
              className="flex size-full flex-col items-start p-6 text-left sm:p-7"
            >
              <span className={cn("text-sm tabular-nums", on ? "text-white/60" : "text-ink-3")}>
                /{String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-3 font-display text-fluid-h3 leading-tight tracking-tight">{item.title}</span>
              {on ? (
                <span className="mt-6 max-w-md text-fluid-body leading-relaxed text-white/80 motion-safe:animate-fade-in sm:mt-auto">
                  {item.body}
                </span>
              ) : (
                <CirclePlus className="mt-6 size-7 text-ink-2 sm:mt-auto" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
