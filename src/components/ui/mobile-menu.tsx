"use client";

import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";
import { NavGroup, type NavChild } from "./nav-group";

/** `children` = pages under the item, shown in a group that opens and closes (see NavGroup). */
export type MenuItem = { href: string; label: string; icon: LucideIcon; badge?: number; children?: NavChild[] };
export type MenuSection = { title: string; items: MenuItem[] };

/**
 * Phones and tablets: a menu button at the top right that drops down every
 * item the desktop sidebar has, in the same groups, with Log out at the end.
 * Closes on a tap outside, on Escape, or when a page is picked. Sits inside a
 * `relative` header so the drop-down lines up under it.
 */
export function MobileMenu({
  sections,
  isActive,
  label,
}: {
  sections: MenuSection[];
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
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="relative grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2"
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        {!open && badges > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20" aria-hidden onClick={() => setOpenOn(null)} />
          <nav
            id="mobile-menu"
            aria-label={label}
            className="absolute inset-x-0 top-full z-50 mt-2 flex max-h-[calc(100dvh-6rem)] flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl"
          >
            {sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                <p className="px-3 pb-1 text-sm text-ink-3">{section.title}</p>
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
                        active ? "bg-accent font-medium text-white" : "text-ink hover:bg-surface-2",
                      )}
                    >
                      <item.icon className="size-[18px] shrink-0" aria-hidden />
                      {item.label}
                      {!!item.badge && (
                        <span
                          className={cn(
                            "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                            active ? "bg-surface/20 text-white" : "bg-accent text-white",
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
