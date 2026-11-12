"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export const THEME_KEY = "meetwell-theme";
type Theme = "system" | "light" | "dark";

/** Applies a theme to <html>; "system" removes the override so the device decides. */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // The phone's status bar follows the choice too, not just the device setting.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.dataset.media ??= meta.media;
    const device = meta.dataset.media;
    meta.media = theme === "system" ? device : device.includes(theme) ? "all" : "not all";
  });
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
    if (saved === "light" || saved === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(saved);
      apply(saved);
    }
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

/** The same choice as three small icons in a row (the avatar menu in the dashboard header). */
export function ThemeIcons({ className }: { className?: string }) {
  const [theme, choose] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-full bg-surface-2 p-0.5", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => choose(o.value)}
          className={cn(
            "grid size-7 place-items-center rounded-full transition-colors",
            theme === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
          )}
        >
          <o.icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
