"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/marketing/logo";
import { saveContact } from "@/lib/contacts/actions";
import { rememberDeviceCard } from "@/lib/contacts/device";
import { cn } from "@/lib/cn";

export type Viewer = "visitor" | "member" | "owner";

/**
 * The bar that floats at the bottom of a card, and what opening a card does:
 * - a logged-in member keeps the card in their Contacts;
 * - a visitor keeps it on their own phone, and the bar asks them to sign up
 *   (through this card) so those contacts are kept for good;
 * - the owner just sees the usual bar.
 */
export function CardKeeper({
  slug,
  fullName,
  source,
  viewer,
  barClass,
  fallback,
}: {
  slug: string;
  fullName: string;
  source: "qr" | "link";
  viewer: Viewer;
  barClass: string;
  /** The usual "Try it for free" bar content. */
  fallback: { href: string; content: ReactNode };
}) {
  const [kept, setKept] = useState(0);
  const firstName = fullName.split(/\s+/)[0];

  useEffect(() => {
    if (viewer === "member") void saveContact(slug, source).catch(() => {});
    // Reading phone storage has to wait until the page is running on the phone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (viewer === "visitor") setKept(rememberDeviceCard({ slug, name: fullName, source }).length);
  }, [slug, fullName, source, viewer]);

  if (viewer === "member") {
    return (
      <Link href="/dashboard/contacts" className={cn(barClass, "sticky bottom-4 mb-4 transition-colors hover:bg-accent-hover")}>
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <Check className="size-5" aria-hidden />
          {firstName} is in your contacts
        </span>
        <span className="text-[13px] font-medium">View all</span>
      </Link>
    );
  }

  if (viewer === "visitor" && kept > 0) {
    return (
      <Link href={`/join?via=${encodeURIComponent(slug)}`} className={cn(barClass, "sticky bottom-4 mb-4 h-auto min-h-12 gap-3 py-2.5 transition-colors hover:bg-accent-hover")}>
        <span className="flex min-w-0 items-center gap-2">
          <LogoMark inverted className="size-5 shrink-0" />
          <span className="min-w-0 text-[14px] font-semibold leading-snug">
            {kept === 1 ? `Keep ${firstName}'s card` : `Keep your ${kept} saved cards`}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-accent">Join free</span>
      </Link>
    );
  }

  return (
    <Link href={fallback.href} className={cn(barClass, "sticky bottom-4 mb-4 transition-colors hover:bg-accent-hover")}>
      {fallback.content}
    </Link>
  );
}
