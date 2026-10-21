"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/profile", label: "Edit card" },
  { href: "/dashboard/qr", label: "QR code" },
  { href: "/dashboard/matches", label: "Matches" },
  { href: "/dashboard/settings", label: "Settings" },
];

/** Only admins see the Invites tab (the page itself also checks in the database). */
const ADMIN_LINKS = [{ href: "/dashboard/invites", label: "Invites" }];

export function DashboardNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mb-px flex gap-1 overflow-x-auto">
      {(isAdmin ? [...LINKS, ...ADMIN_LINKS] : LINKS).map((l) => {
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
          </Link>
        );
      })}
    </nav>
  );
}
