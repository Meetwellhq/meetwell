"use client";

import {
  BadgeCheck,
  IdCard,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  QrCode,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; unread?: boolean };

const isActive = (pathname: string, href: string) =>
  href === "/dashboard" ? pathname === href : pathname.startsWith(href);

function UnreadBadge({ n, active }: { n: number; active: boolean }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        active ? "bg-white/20 text-white" : "bg-accent text-white",
      )}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/**
 * Dashboard sidebar on large screens; a scrollable row of tabs on small ones.
 * Mentoring shows for 4+ years; Messages only for people who have a conversation, with their unread count.
 */
export function DashboardNav({ messages, mentor = false }: { messages?: { unread: number } | null; mentor?: boolean }) {
  const pathname = usePathname();
  const sections: { title: string; items: Item[] }[] = [
    {
      title: "Menu",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/profile", label: "Edit card", icon: IdCard },
        { href: "/dashboard/qr", label: "QR code", icon: QrCode },
      ],
    },
    {
      title: "Connect",
      items: [
        { href: "/dashboard/matches", label: "Spark", icon: Sparkles },
        ...(mentor ? [{ href: "/dashboard/mentor", label: "Mentoring", icon: BadgeCheck }] : []),
        ...(messages ? [{ href: "/dashboard/messages", label: "Messages", icon: MessagesSquare, unread: true }] : []),
      ],
    },
  ];
  const all: Item[] = [...sections.flatMap((s) => s.items), { href: "/dashboard/settings", label: "Settings", icon: Settings }];
  const unread = messages?.unread ?? 0;

  return (
    <>
      {/* Small screens: one scrollable row. */}
      <nav aria-label="Dashboard" className="flex gap-1.5 overflow-x-auto rounded-2xl bg-surface p-2 lg:hidden">
        {all.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm",
                active ? "bg-accent font-medium text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
              {item.unread && <UnreadBadge n={unread} active={active} />}
            </Link>
          );
        })}
      </nav>

      {/* Large screens: the sidebar. */}
      <aside className="hidden lg:block">
        <nav aria-label="Dashboard" className="sticky top-6 flex flex-col gap-6 rounded-2xl bg-surface p-4">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-sm text-ink-3">{section.title}</p>
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
                      active ? "bg-accent font-medium text-white" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden />
                    {item.label}
                    {item.unread && <UnreadBadge n={unread} active={active} />}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-sm text-ink-3">General</p>
            <Link
              href="/dashboard/settings"
              aria-current={isActive(pathname, "/dashboard/settings") ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
                isActive(pathname, "/dashboard/settings") ? "bg-accent font-medium text-white" : "text-ink hover:bg-surface-2",
              )}
            >
              <Settings className="size-[18px] shrink-0" aria-hidden />
              Settings
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-[15px] text-danger hover:bg-danger/10"
              >
                <LogOut className="size-[18px]" aria-hidden />
                Log out
              </button>
            </form>
          </div>
        </nav>
      </aside>
    </>
  );
}
