"use client";

import {
  HandHeart,
  BookUser,
  ChartLine,
  Handshake,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  ReceiptText,
  Wallet as WalletIcon,
  Settings,
  Sparkles,
  SunMoon,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { NavGroup, type NavChild } from "@/components/ui/nav-group";
import { ThemeIcons } from "@/components/ui/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; unread?: boolean; children?: NavChild[] };
type Me = { name: string; email: string | null; avatarUrl: string | null };

const isActive = (pathname: string, href: string) =>
  href === "/dashboard" ? pathname === href : pathname.startsWith(href);

function UnreadBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        "bg-accent text-white",
      )}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/**
 * The member's avatar at the top right of the header (laptops and up; phones
 * use the menu button). Clicking it drops down their full name and email, then
 * Profile (the card editor), Settings, the theme (System, Light, Dark) and Log out. Closes on a click outside,
 * on Escape, or when a page is picked.
 */
export function AccountMenu({ me, className }: { me: Me; className?: string }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const ref = useRef<HTMLDivElement>(null);

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

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors";
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`${me.name}: account menu`}
        className="grid place-items-center rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-border-strong"
      >
        <Avatar name={me.name} src={me.avatarUrl} className="size-9 text-xs" />
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-border px-3 pb-3 pt-2">
            <Avatar name={me.name} src={me.avatarUrl} className="size-10 shrink-0 text-sm" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-ink">{me.name}</span>
              {me.email && <span className="truncate text-xs text-ink-3">{me.email}</span>}
            </span>
          </div>
          <Link href="/dashboard/profile" onClick={() => setOpenOn(null)} className={cn(item, "mt-1 text-ink hover:bg-surface-2")}>
            <UserRound className="size-[18px] shrink-0" aria-hidden />
            Profile
          </Link>
          <Link href="/dashboard/settings" onClick={() => setOpenOn(null)} className={cn(item, "text-ink hover:bg-surface-2")}>
            <Settings className="size-[18px] shrink-0" aria-hidden />
            Settings
          </Link>
          <div className="flex items-center gap-3 px-3 py-1.5 text-[15px] text-ink">
            <SunMoon className="size-[18px] shrink-0" aria-hidden />
            Theme
            <ThemeIcons className="ml-auto" />
          </div>
          <form action={signOut} className="mt-0.5 border-t border-border pt-1">
            <button type="submit" className={cn(item, "text-danger hover:bg-danger/10")}>
              <LogOut className="size-[18px] shrink-0" aria-hidden />
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * The member menu: the sidebar on large screens (`sidebar`), and on phones and
 * tablets a menu button at the top right of the header whose drop-down lists
 * the same items (`menu`). Mentoring shows for 4+ years; Messages only for
 * people who have a conversation, with their unread count; Partner only for
 * people on a partner's team. Profile, Settings and Log out are in the
 * header's AccountMenu, and phones list them in their menu.
 */
export function DashboardNav({
  placement,
  messages,
  mentor = false,
  partner = false,
  spark = false,
}: {
  placement: "sidebar" | "menu";
  messages?: { unread: number } | null;
  mentor?: boolean;
  partner?: boolean;
  /** Spark is hidden completely until it launches. */
  spark?: boolean;
}) {
  const pathname = usePathname();
  // The first group has no label; empty groups are left out.
  const sections = (
    [
      {
        title: "",
        items: [
          { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
          { href: "/dashboard/analytics", label: "Analytics", icon: ChartLine },
        ],
      },
      {
        title: "Connect",
        items: [
          { href: "/dashboard/contacts", label: "Contacts", icon: BookUser },
          ...(spark ? [{ href: "/dashboard/matches", label: "Spark", icon: Sparkles }] : []),
          ...(messages ? [{ href: "/dashboard/messages", label: "Messages", icon: MessagesSquare, unread: true }] : []),
        ],
      },
      {
        title: "Earn",
        items: [
          ...(mentor
            ? [
                {
                  href: "/dashboard/mentor",
                  label: "Mentoring",
                  icon: HandHeart,
                  children: [
                    { href: "/dashboard/mentor/wallet", label: "Wallet", icon: WalletIcon },
                    { href: "/dashboard/mentor/transactions", label: "Transactions", icon: ReceiptText },
                  ],
                },
              ]
            : []),
          ...(partner ? [{ href: "/dashboard/partner", label: "Partner", icon: Handshake }] : []),
        ],
      },
    ] as { title: string; items: Item[] }[]
  ).filter((s) => s.items.length > 0);
  const unread = messages?.unread ?? 0;

  if (placement === "menu") {
    return (
      <MobileMenu
        label="Dashboard"
        isActive={isActive}
        sections={[
          ...sections.map((s) => ({
            title: s.title,
            items: s.items.map(({ unread: hasUnread, ...item }) => ({ ...item, badge: hasUnread ? unread : 0 })),
          })),
          {
            title: "General",
            items: [
              { href: "/dashboard/profile", label: "Profile", icon: UserRound },
              { href: "/dashboard/settings", label: "Settings", icon: Settings },
            ],
          },
        ]}
      />
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
      {/* Fills the screen under the header; the menu scrolls if it must. */}
      <div className="sticky top-[calc(3.75rem+1px)] flex h-[calc(100dvh-3.75rem-1px)] flex-col">
        <nav aria-label="Dashboard" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              {section.title && <p className="px-3 pb-1 pt-3 text-sm text-ink-3">{section.title}</p>}
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                if (item.children) {
                  return <NavGroup key={item.href} {...item} items={item.children} pathname={pathname} />;
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
                      active ? "bg-surface-2 font-medium text-ink" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden />
                    {item.label}
                    {item.unread && <UnreadBadge n={unread} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
