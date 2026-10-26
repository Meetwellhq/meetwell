"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export const THEME_KEY = "meetwell-theme";
type Theme = "system" | "light" | "dark";

/** Applies a theme to <html>; "system" removes the override so the device decides. */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

const OPTIONS = [
  { value: "system" as const, label: "System", icon: Monitor },
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
];

/** The saved choice (kept in this browser) and a way to change it. */
function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {}
    // Reading the saved choice has to wait until the page runs in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {}
  };
  return [theme, choose] as const;
}

/**
 * System / Light / Dark switch. The choice is kept in this browser; the script in
 * the root layout applies it before the page paints, so there's no flash.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, choose] = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-full border border-border bg-surface-2 p-0.5", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          title={o.label}
          onClick={() => choose(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            theme === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
          )}
        >
          <o.icon className="size-3.5" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The same choice as a small square button showing the current theme's icon;
 * clicking it opens a menu above it (sidebar). Closes on a click outside, on
 * Escape, or after picking.
 */
export function ThemeMenu({ className }: { className?: string }) {
  const [theme, choose] = useTheme();
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const ref = useRef<HTMLDivElement>(null);
  const Current = OPTIONS.find((o) => o.value === theme)!.icon;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {open && (
        <div
          id="theme-menu"
          role="radiogroup"
          aria-label="Theme"
          className="absolute bottom-full left-0 z-10 mb-2 flex w-40 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={theme === o.value}
              onClick={() => {
                choose(o.value);
                setOpenOn(null);
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-2"
            >
              <o.icon className="size-4 shrink-0" aria-hidden />
              {o.label}
              {theme === o.value && <Check className="ml-auto size-4 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="theme-menu"
        aria-label="Theme"
        title="Theme"
        className="grid size-9 place-items-center rounded-lg bg-surface-2 text-ink-2 hover:text-ink"
      >
        <Current className="size-4" aria-hidden />
      </button>
    </div>
  );
}
