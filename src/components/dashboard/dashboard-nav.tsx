"use client";

import {
  HandHeart,
  BookUser,
  ChartLine,
  ChevronsUpDown,
  Handshake,
  IdCard,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  ReceiptText,
  Wallet as WalletIcon,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { NavGroup, type NavChild } from "@/components/ui/nav-group";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; unread?: boolean; children?: NavChild[] };
type Me = { name: string; email: string | null; avatarUrl: string | null };

const isActive = (pathname: string, href: string) =>
  href === "/dashboard" ? pathname === href : pathname.startsWith(href);

function UnreadBadge({ n, active }: { n: number; active: boolean }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        active ? "bg-surface/20 text-white" : "bg-accent text-white",
      )}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/**
 * The member's photo, name and email at the bottom of the sidebar. Clicking it
 * opens a small menu above it: Edit profile, Settings and Log out. Closes on a
 * click outside, on Escape, or when a page is picked.
 */
function ProfileMenu({ me, pathname }: { me: Me; pathname: string }) {
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
    <div ref={ref} className="relative border-t border-border p-3">
      {open && (
        <div
          id="profile-menu"
          className="absolute inset-x-3 bottom-full mb-2 flex flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          <Link href="/dashboard/profile" onClick={() => setOpenOn(null)} className={cn(item, "text-ink hover:bg-surface-2")}>
            <IdCard className="size-[18px] shrink-0" aria-hidden />
            Edit profile
          </Link>
          <Link href="/dashboard/settings" onClick={() => setOpenOn(null)} className={cn(item, "text-ink hover:bg-surface-2")}>
            <Settings className="size-[18px] shrink-0" aria-hidden />
            Settings
          </Link>
          <form action={signOut} className="mt-0.5 border-t border-border pt-1">
            <button type="submit" className={cn(item, "text-danger hover:bg-danger/10")}>
              <LogOut className="size-[18px] shrink-0" aria-hidden />
              Log out
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="profile-menu"
        aria-label={`${me.name}: profile menu`}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
      >
        <Avatar name={me.name} src={me.avatarUrl} className="size-9 shrink-0 text-xs" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-ink">{me.name}</span>
          {me.email && <span className="truncate text-xs text-ink-3">{me.email}</span>}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-3" aria-hidden />
      </button>
    </div>
  );
}

/**
 * The member menu: the sidebar on large screens (`sidebar`), and on phones and
 * tablets a menu button at the top right of the header whose drop-down lists
 * the same items (`menu`). Mentoring shows for 4+ years; Messages only for
 * people who have a conversation, with their unread count; Partner only for
 * people on a partner's team. The sidebar ends with the member's profile,
 * pinned to the bottom (ProfileMenu).
 */
export function DashboardNav({
  placement,
  messages,
  mentor = false,
  partner = false,
  spark = false,
  me,
}: {
  placement: "sidebar" | "menu";
  messages?: { unread: number } | null;
  mentor?: boolean;
  partner?: boolean;
  /** Spark is hidden completely until it launches. */
  spark?: boolean;
  /** Shown at the bottom of the sidebar. */
  me?: Me;
}) {
  const pathname = usePathname();
  const sections: { title: string; items: Item[] }[] = [
    {
      title: "Menu",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/analytics", label: "Analytics", icon: ChartLine },
        { href: "/dashboard/profile", label: "Edit card", icon: IdCard },
      ],
    },
    {
      title: "Connect",
      items: [
        { href: "/dashboard/contacts", label: "Contacts", icon: BookUser },
        ...(spark ? [{ href: "/dashboard/matches", label: "Spark", icon: Sparkles }] : []),
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
        ...(messages ? [{ href: "/dashboard/messages", label: "Messages", icon: MessagesSquare, unread: true }] : []),
        ...(partner ? [{ href: "/dashboard/partner", label: "Partner", icon: Handshake }] : []),
      ],
    },
  ];
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
          { title: "General", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }] },
        ]}
        titles={false}
      />
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
      {/* Fills the screen under the header: the menu scrolls if it must, the profile stays at the bottom. */}
      <div className="sticky top-[calc(3.75rem+1px)] flex h-[calc(100dvh-3.75rem-1px)] flex-col">
        {/* No group titles: thin lines split the groups. */}
        <nav aria-label="Dashboard" className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto px-4">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1 py-4">
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
          <div className="flex flex-col gap-1 py-4">
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
        {me && <ProfileMenu me={me} pathname={pathname} />}
      </div>
    </aside>
  );
}
