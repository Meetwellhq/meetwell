"use client";

import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";
import { Logo } from "@/components/marketing/logo";
import { cn } from "@/lib/cn";
import { NavGroup, type NavChild } from "./nav-group";

/** `children` = pages under the item, shown in a group that opens and closes (see NavGroup). */
export type MenuItem = { href: string; label: string; icon: LucideIcon; badge?: number; children?: NavChild[] };
export type MenuSection = { title: string; items: MenuItem[] };

/**
 * Phones and tablets: a menu button at the top right that opens a full-height
 * panel on the left with every item the desktop sidebar has, in the same
 * groups, and Log out at the end. The page behind dims and can't scroll.
 * Closes on a tap outside, on Escape, on the close button, or when a page is picked.
 */
export function MobileMenu({
  sections,
  isActive,
  label,
  beta = true,
  extras,
}: {
  sections: MenuSection[];
  /** The Beta tag on the logo at the top of the panel (off in admin). */
  beta?: boolean;
  /** Extra rows above Log out (the member menu: theme and Ideas). Gets a function that closes the panel. */
  extras?: (close: () => void) => ReactNode;
  isActive: (pathname: string, href: string) => boolean;
  label: string;
}) {
  const pathname = usePathname();
  // Open for the page it was opened on, so picking a page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const badges = sections.flatMap((s) => s.items).reduce((n, i) => n + (i.badge ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    window.addEventListener("keydown", onKey);
    // The page behind stays put while the panel is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        // Hidden while open: the panel has its own close button.
        className={cn("relative grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2", open && "invisible")}
      >
        <Menu className="size-6" aria-hidden />
        {!open && badges > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/30" aria-hidden onClick={() => setOpenOn(null)} />
          <nav
            id="mobile-menu"
            aria-label={label}
            className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[85vw] max-w-sm select-none flex-col gap-5 overflow-y-auto overscroll-contain border-r border-border bg-surface px-4 pb-6 shadow-xl"
          >
            <div className="-mx-4 flex h-15 shrink-0 items-center justify-between border-b border-border px-4">
              <Logo large beta={beta} />
              <button
                type="button"
                onClick={() => setOpenOn(null)}
                aria-label="Close menu"
                className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2"
              >
                <X className="size-6" aria-hidden />
              </button>
            </div>
            {sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                {/* A group can have no title (the first one in the member menu). */}
                {section.title && <p className="px-3 pb-1 text-sm text-ink-3">{section.title}</p>}
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  if (item.children) {
                    return <NavGroup key={item.href} {...item} items={item.children} pathname={pathname} onNavigate={() => setOpenOn(null)} />;
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpenOn(null)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
                        active ? "bg-surface-2 font-medium text-ink" : "text-ink hover:bg-surface-2",
                      )}
                    >
                      <item.icon className="size-[18px] shrink-0" aria-hidden />
                      {item.label}
                      {!!item.badge && (
                        <span
                          className={cn(
                            "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                            "bg-accent text-white",
                          )}
                        >
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
            {extras && <div className="flex flex-col gap-1">{extras(() => setOpenOn(null))}</div>}
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-[15px] text-danger hover:bg-danger/10"
              >
                <LogOut className="size-[18px]" aria-hidden />
                Log out
              </button>
            </form>
          </nav>
        </>
      )}
    </div>
  );
}
