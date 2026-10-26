"use client";

import {
  HandHeart,
  BookUser,
  ChartLine,
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
import { MobileMenu } from "@/components/ui/mobile-menu";
import { NavGroup, type NavChild } from "@/components/ui/nav-group";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; unread?: boolean; children?: NavChild[] };

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
 * The member menu: the sidebar on large screens (`sidebar`), and on phones and
 * tablets a menu button at the top right of the header whose drop-down lists
 * the same items (`menu`). Mentoring shows for 4+ years; Messages only for
 * people who have a conversation, with their unread count; Partner only for
 * people on a partner's team.
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
      />
    );
  }

  return (
    <aside className="hidden lg:block">
      <nav aria-label="Dashboard" className="sticky top-6 flex flex-col gap-6 rounded-2xl bg-surface p-4">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-sm text-ink-3">{section.title}</p>
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
  );
}
