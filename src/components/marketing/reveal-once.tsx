"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Plays its children's entrance once, when it scrolls into view. Children style
 * their hidden state with group-data-waiting:*. It only hides them once the page
 * is running, so they still show without JavaScript or with motion turned off.
 */
export function RevealOnce({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.waiting = "";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        delete el.dataset.waiting;
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={cn("group", className)}>
      {children}
    </span>
  );
}
