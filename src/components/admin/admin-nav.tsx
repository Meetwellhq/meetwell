"use client";

import {
  HandHeart,
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Megaphone,
  MessagesSquare,
  Send,
  Handshake,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon; count?: keyof Counts };
/** Things waiting on the admin: invites to send, open reports, mentor applications plus withdrawals to approve. */
export type Counts = { waiting: number; reports: number; mentors: number };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Menu",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/waitlist", label: "Waiting list", icon: ListOrdered, count: "waiting" },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/outreach", label: "Outreach", icon: Send },
      { href: "/admin/partners", label: "Partners", icon: Handshake },
    ],
  },
  {
    title: "Mentoring",
    items: [
      { href: "/admin/mentors", label: "Mentors", icon: HandHeart, count: "mentors" },
      { href: "/admin/messages", label: "Messages", icon: MessagesSquare, count: "reports" },
    ],
  },
  {
    title: "Money and emails",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
];

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

function CountBadge({ n, active }: { n: number; active: boolean }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        active ? "bg-surface/20 text-white" : "bg-accent text-white",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * The admin menu: the sidebar on large screens (`sidebar`), and on phones and
 * tablets a menu button at the top right whose drop-down lists the same groups
 * with their counts (`menu`).
 */
export function AdminNav({ counts, placement }: { counts: Counts; placement: "sidebar" | "menu" }) {
  const pathname = usePathname();

  if (placement === "menu") {
    return (
      <MobileMenu
        label="Admin"
        isActive={isActive}
        sections={SECTIONS.map((s) => ({
          title: s.title,
          items: s.items.map(({ count, ...item }) => ({ ...item, badge: count ? counts[count] : 0 })),
        }))}
      />
    );
  }

  return (
    <>
      {/* Large screens: the sidebar. */}
      <aside className="hidden lg:block">
        <nav aria-label="Admin" className="sticky top-6 flex flex-col gap-6 rounded-2xl bg-surface p-4">
          {SECTIONS.map((section) => (
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
                    {item.count && <CountBadge n={counts[item.count]} active={active} />}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-sm text-ink-3">General</p>
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
