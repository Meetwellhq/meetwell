"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/profile", label: "Edit card" },
  { href: "/dashboard/qr", label: "QR code" },
  { href: "/dashboard/matches", label: "Spark" },
  { href: "/dashboard/settings", label: "Settings" },
];

/** Messages shows only for people who have a conversation, with their unread count. */
export function DashboardNav({ messages, mentor = false }: { messages?: { unread: number } | null; mentor?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mb-px flex gap-1 overflow-x-auto">
      {[
        ...LINKS.slice(0, 4),
        ...(mentor ? [{ href: "/dashboard/mentor", label: "Mentoring" }] : []),
        ...(messages ? [{ href: "/dashboard/messages", label: "Messages" }] : []),
        ...LINKS.slice(4),
      ].map((l) => {
        const active = l.href === "/dashboard" ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
              active ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {l.label}
            {l.href === "/dashboard/messages" && !!messages?.unread && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                {messages.unread > 99 ? "99+" : messages.unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
