"use client";

import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";

export type NavChild = { href: string; label: string; icon: LucideIcon };

/**
 * A menu item with pages under it (Mentoring → Wallet, Transactions), for the
 * sidebar and the phone menu. The arrow shows or hides them: right when closed,
 * down when open. Open by default on any of its pages. The pages under it have
 * a lighter look than the main items, hanging off a thin line.
 */
export function NavGroup({
  href,
  label,
  icon: Icon,
  items,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  items: NavChild[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const inside = pathname === href || pathname.startsWith(`${href}/`);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? inside;
  const here = pathname === href;
  const listId = `nav-${href.replaceAll("/", "-")}`;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex items-center rounded-lg transition-colors",
          here ? "bg-accent text-white" : inside ? "text-accent" : "text-ink hover:bg-surface-2",
        )}
      >
        <Link
          href={href}
          aria-current={here ? "page" : undefined}
          onClick={onNavigate}
          className={cn("flex flex-1 items-center gap-3 px-3 py-2.5 text-[15px]", (here || inside) && "font-medium")}
        >
          <Icon className="size-[18px] shrink-0" aria-hidden />
          {label}
        </Link>
        <button
          type="button"
          onClick={() => setToggled(!open)}
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? `Hide ${label} pages` : `Show ${label} pages`}
          className={cn("mr-1 grid size-8 place-items-center rounded-md", here ? "hover:bg-white/15" : "hover:bg-surface-2")}
        >
          {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
        </button>
      </div>
      {open && (
        <div id={listId} className="ml-[1.4rem] mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
          {items.map((c) => {
            const active = pathname.startsWith(c.href);
            return (
              <Link
                key={c.href}
                href={c.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <c.icon className="size-4 shrink-0" aria-hidden />
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
