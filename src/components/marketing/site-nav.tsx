"use client";

import {
  ArrowRight,
  BookUser,
  ChartLine,
  ChevronDown,
  HandHeart,
  Info,
  LifeBuoy,
  Menu,
  MessageSquareText,
  Mic,
  QrCode,
  ScrollText,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { JOIN_CTA } from "@/lib/config";
import type { FeatureSlug } from "@/lib/features";

type Item = { href: string; label: string; note: string; icon: LucideIcon };
type Group = { label: string; items: Item[] };

const FEATURE_ICONS: Record<FeatureSlug, LucideIcon> = {
  "qr-card": QrCode,
  icebreaker: MessageSquareText,
  contacts: BookUser,
  spark: Sparkles,
  mentoring: HandHeart,
  analytics: ChartLine,
  events: Mic,
};

const RESOURCES: Item[] = [
  { href: "/about", label: "About", note: "Who we are and why we built it.", icon: Info },
  { href: "/changelog", label: "Changelog", note: "What's new on Meetwell.", icon: ScrollText },
  { href: "/support", label: "Support", note: "Answers and how to reach us.", icon: LifeBuoy },
  { href: "/community-rules", label: "Community rules", note: "How we keep Meetwell friendly.", icon: ShieldCheck },
];

/**
 * The landing header's menus, after Calendly's: Product and Resources open a
 * panel on hover or click; on phones everything folds into
 * one menu button.
 */
export function SiteNav({
  signedIn,
  features,
}: {
  signedIn: boolean;
  features: { slug: FeatureSlug; name: string; title: string }[];
}) {
  const groups: Group[] = [
    {
      label: "Product",
      items: features.map((f) => ({ href: `/features/${f.slug}`, label: f.name, note: f.title, icon: FEATURE_ICONS[f.slug] })),
    },
    { label: "Resources", items: RESOURCES },
  ];
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const nav = useRef<HTMLDivElement>(null);

  // Close everything on Escape, on a click outside and when a link is followed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(null), setMobile(false));
    const onClick = (e: MouseEvent) => !nav.current?.contains(e.target as Node) && setOpen(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const actions = signedIn ? (
    <ButtonLink href="/dashboard" className="rounded-lg!">
      Dashboard
    </ButtonLink>
  ) : (
    <>
      <ButtonLink href="/sign-in" variant="secondary" className="rounded-lg! border-ink!">
        Log in
      </ButtonLink>
      <ButtonLink href={JOIN_CTA.href} className="rounded-lg!">
        {JOIN_CTA.label}
      </ButtonLink>
    </>
  );

  return (
    <div
      ref={nav}
      className="flex flex-1 items-center justify-between"
      onClick={(e) => (e.target as HTMLElement).closest("a") && (setOpen(null), setMobile(false))}
    >
      {/* Desktop: menus beside the logo, buttons on the right. */}
      <nav aria-label="Main" className="ml-8 hidden items-center gap-1 lg:flex">
        {groups.map((g) => (
          <div key={g.label} className="relative" onMouseEnter={() => setOpen(g.label)} onMouseLeave={() => setOpen(null)}>
            <button
              type="button"
              aria-expanded={open === g.label}
              onClick={() => setOpen(open === g.label ? null : g.label)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              {g.label}
              <ChevronDown className={cn("size-4 transition-transform", open === g.label && "rotate-180")} aria-hidden />
            </button>
            {open === g.label && (
              // pt-2 keeps the hover alive while the pointer moves down into the panel.
              <div className="absolute left-0 top-full z-50 pt-2">
                <ul className="grid w-[34rem] grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-3 shadow-xl">
                  {g.items.map((it) => (
                    <li key={it.href + it.label}>
                      <MenuLink item={it} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="ml-auto hidden items-center gap-2 lg:flex">
        {actions}
      </div>

      {/* Phones and tablets: the main button stays, the rest goes in the menu. */}
      <div className="ml-auto flex items-center gap-2 lg:hidden">
        {signedIn ? (
          <ButtonLink href="/dashboard" size="sm" className="rounded-lg!">
            Dashboard
          </ButtonLink>
        ) : (
          <ButtonLink href={JOIN_CTA.href} size="sm" className="rounded-lg!">
            {JOIN_CTA.short}
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        )}
        <button
          type="button"
          aria-label={mobile ? "Close menu" : "Open menu"}
          aria-expanded={mobile}
          onClick={() => setMobile(!mobile)}
          className="grid size-9 place-items-center rounded-lg text-ink hover:bg-surface-2"
        >
          {mobile ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      {mobile && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-surface px-4 pb-8 pt-2 lg:hidden">
          {groups.map((g) => (
            <details key={g.label} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[17px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {g.label}
                <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="flex flex-col gap-1 pb-3">
                {g.items.map((it) => (
                  <li key={it.href + it.label}>
                    <MenuLink item={it} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {!signedIn && (
            <div className="mt-6 flex flex-col gap-2 [&>a]:w-full">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({ item }: { item: Item }) {
  return (
    <Link href={item.href} className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-surface-2">
      {/* Grey box around the icon; white while the row is hovered (the row itself turns grey). */}
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink transition-colors group-hover:bg-surface">
        <item.icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{item.label}</span>
        <span className="block text-[13px] leading-snug text-ink-2">{item.note}</span>
      </span>
    </Link>
  );
}
