"use client";

import { ArrowRight, BookUser, ChartLine, HandHeart, MessageSquareText, Mic, QrCode, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AnalyticsPreview, ContactsPreview, EventPreview, MentorPreview, SparkPreview, StarterPreview } from "./card-preview";
import { ScanVisual } from "./landing";

type Tab = { key: string; label: string; icon: LucideIcon; title: string; body: string; href: string; visual: ReactNode; tint: string };

/**
 * One showcase for every feature (after Calendly's): icon tabs on a soft green
 * frame, and the chosen feature below with its illustration. Replaces a long
 * run of separate sections. Spark only shows once it has launched.
 */
export function FeatureTabs({ qrSvg, spark }: { qrSvg: string; spark: boolean }) {
  const tabs: Tab[] = [
    {
      key: "qr-card",
      label: "QR card",
      icon: QrCode,
      title: "One scan. No app. No typing.",
      body: "People point their phone camera at your code and your card opens. They save you to their contacts in one tap.",
      href: "/features/qr-card",
      visual: <ScanVisual qrSvg={qrSvg} />,
      tint: "bg-sage",
    },
    {
      key: "icebreaker",
      label: "Icebreaker",
      icon: MessageSquareText,
      title: "Never stare at a blank message again.",
      body: "Visitors get a short first message based on your card, ready to edit and send.",
      href: "/features/icebreaker",
      visual: (
        <div className="w-full max-w-md">
          <StarterPreview />
        </div>
      ),
      tint: "bg-clay",
    },
    {
      key: "contacts",
      label: "Contacts",
      icon: BookUser,
      title: "Every card you scan, kept.",
      body: "Everyone you meet lands in your Contacts, with a note on where you met. See who saved your card, and save them back.",
      href: "/features/contacts",
      visual: <ContactsPreview />,
      tint: "bg-sage",
    },
    ...(spark
      ? [
          {
            key: "spark",
            label: "Spark",
            icon: Sparkles,
            title: "Meet people a few steps ahead.",
            body: "Spark uses AI to introduce you to someone with more experience in your field, and tells you why you should talk.",
            href: "/features/spark",
            visual: <SparkPreview />,
            tint: "bg-clay",
          },
        ]
      : []),
    {
      key: "mentoring",
      label: "Mentoring",
      icon: HandHeart,
      title: "Get paid for what you know.",
      body: "With 4+ years of experience, become a mentor. Set a monthly price, answer messages and keep 80% of every payment.",
      href: "/features/mentoring",
      visual: <MentorPreview />,
      tint: "bg-clay",
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: ChartLine,
      title: "See who's finding you.",
      body: "See how many people viewed your card, scanned your code and saved you, day by day. Anonymous totals only.",
      href: "/features/analytics",
      visual: <AnalyticsPreview />,
      tint: "bg-sage",
    },
    {
      key: "events",
      label: "Events",
      icon: Mic,
      title: "Speaking at an event? Bring your card.",
      body: "Every speaker on one page, and your own QR code for your badge or slides, so people follow up after your talk.",
      href: "/features/events",
      visual: <EventPreview />,
      tint: "bg-clay",
    },
  ];
  const [active, setActive] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="rounded-[1.75rem] bg-gradient-to-br from-sage via-accent-soft to-clay p-2.5 sm:p-5">
      {/* The tabs: icons on a pill, labels under them from tablets up. */}
      <div role="tablist" aria-label="Features" className="-mx-1 flex justify-start gap-2 overflow-x-auto px-1 pb-3 sm:justify-center sm:pb-4">
        {tabs.map((t) => {
          const on = t.key === tab.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              aria-controls="feature-panel"
              onClick={() => setActive(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                on ? "bg-surface text-ink shadow-sm ring-1 ring-accent/30" : "bg-surface/60 text-ink-2 hover:bg-surface/90 hover:text-ink",
              )}
            >
              <span className={cn("grid size-7 place-items-center rounded-full", on ? "bg-accent text-accent-ink" : "bg-surface text-ink-2")}>
                <t.icon className="size-4" aria-hidden />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        id="feature-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab.key}`}
        className="grid items-center gap-8 rounded-[1.25rem] bg-surface p-6 sm:p-10 lg:grid-cols-2 lg:gap-14 lg:p-12"
      >
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
            <tab.icon className="size-4" aria-hidden />
            {tab.label}
          </span>
          <h3 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">{tab.title}</h3>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-2">{tab.body}</p>
          <Link href={tab.href} className="mt-7 inline-flex items-center gap-1.5 border-b border-ink pb-0.5 text-[15px] font-medium text-ink hover:border-accent hover:text-accent">
            Learn more
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className={cn("flex min-h-[20rem] items-center justify-center overflow-hidden rounded-[1.25rem] p-6 sm:min-h-[26rem] sm:p-10", tab.tint)}>
          {tab.visual}
        </div>
      </div>
    </div>
  );
}
