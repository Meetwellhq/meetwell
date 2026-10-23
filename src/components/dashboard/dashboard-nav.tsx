"use client";

import {
  BadgeCheck,
  BookUser,
  Handshake,
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
import { Avatar } from "@/components/ui/avatar";
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
        active ? "bg-surface/20 text-white" : "bg-accent text-white",
      )}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/** Pages reached from the Profile tab on phones (the Profile hub lists them). */
const PROFILE_PAGES = ["/dashboard/me", "/dashboard/profile", "/dashboard/qr", "/dashboard/settings", "/dashboard/partner"];

/**
 * Phones: a bar fixed to the bottom with Overview, Contacts, Spark, Messages
 * (and Mentoring for mentors) and Profile. Everything else (Edit card, QR code,
 * Settings, Partner) is inside Profile. Hidden on Edit card, which has its own Save bar there.
 */
function BottomNav({
  pathname,
  unread,
  avatar,
  mentor,
}: {
  pathname: string;
  unread: number;
  avatar: { name: string; src: string | null };
  mentor: boolean;
}) {
  if (pathname.startsWith("/dashboard/profile")) return null;
  const tabs = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/contacts", label: "Contacts", icon: BookUser },
    { href: "/dashboard/matches", label: "Spark", icon: Sparkles },
    { href: "/dashboard/messages", label: "Messages", icon: MessagesSquare, unread: true },
    ...(mentor ? [{ href: "/dashboard/mentor", label: "Mentoring", icon: BadgeCheck }] : []),
  ];
  const profileActive = PROFILE_PAGES.some((p) => pathname.startsWith(p));

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className={cn("mx-auto grid max-w-md", mentor ? "grid-cols-6" : "grid-cols-5")}>
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[11px] font-medium",
                  active ? "text-accent" : "text-ink-3 hover:text-ink",
                )}
              >
                <span className="relative">
                  <tab.icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {tab.unread && unread > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] leading-[18px] font-semibold text-white tabular-nums">
                      {unread > 99 ? "99+" : unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/dashboard/me"
            aria-current={profileActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[11px] font-medium",
              profileActive ? "text-accent" : "text-ink-3 hover:text-ink",
            )}
          >
            <Avatar
              name={avatar.name}
              src={avatar.src}
              className={cn("size-6 text-[10px]", profileActive && "ring-2 ring-accent ring-offset-1 ring-offset-surface")}
            />
            Profile
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Dashboard sidebar on large screens; the bottom bar on phones.
 * Mentoring shows for 4+ years; Messages only for people who have a conversation (always on phones), with their
 * unread count; Partner only for people on a partner's team.
 */
export function DashboardNav({
  messages,
  mentor = false,
  partner = false,
  avatar,
}: {
  messages?: { unread: number } | null;
  mentor?: boolean;
  partner?: boolean;
  avatar: { name: string; src: string | null };
}) {
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
        { href: "/dashboard/contacts", label: "Contacts", icon: BookUser },
        { href: "/dashboard/matches", label: "Spark", icon: Sparkles },
        ...(mentor ? [{ href: "/dashboard/mentor", label: "Mentoring", icon: BadgeCheck }] : []),
        ...(messages ? [{ href: "/dashboard/messages", label: "Messages", icon: MessagesSquare, unread: true }] : []),
        ...(partner ? [{ href: "/dashboard/partner", label: "Partner", icon: Handshake }] : []),
      ],
    },
  ];
  const unread = messages?.unread ?? 0;

  return (
    <>
      <BottomNav pathname={pathname} unread={unread} avatar={avatar} mentor={mentor} />

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
