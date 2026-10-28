"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A sideways-scrolling list tied to the page scroll: as the row travels up the screen, it slides
 * left from its first card to its last, and back again when you scroll up. It can still be swiped
 * by hand. Stays put for people who prefer reduced motion.
 */
export function AutoScrollRow({ className, children }: { className?: string; children: ReactNode }) {
  const row = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = row.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const r = el.getBoundingClientRect();
      // 0 when the row's top appears at the foot of the screen, 1 when it reaches the header,
      // so it slides evenly over the whole time it's coming into view.
      const start = window.innerHeight;
      const end = 96;
      const progress = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      el.scrollLeft = progress * max;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <ul ref={row} className={className}>
      {children}
    </ul>
  );
}
