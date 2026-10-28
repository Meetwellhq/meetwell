"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const STEP_MS = 3500;

/**
 * A sideways-scrolling list that moves on by itself: every few seconds it slides one card to the
 * left, and back to the start after the last one. Pauses on hover, touch or keyboard focus, and
 * stays still for people who prefer reduced motion.
 */
export function AutoScrollRow({ className, children }: { className?: string; children: ReactNode }) {
  const row = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const el = row.current;
      const first = el?.firstElementChild as HTMLElement | null;
      if (!el || !first) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: "smooth" });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <ul
      ref={row}
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {children}
    </ul>
  );
}
