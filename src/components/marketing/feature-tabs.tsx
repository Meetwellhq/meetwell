"use client";

import { ArrowRight, BookUser, ChartLine, HandHeart, MessageSquareText, Mic, QrCode, Sparkles, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AnalyticsPreview, ContactsPreview, EventPreview, MentorPreview, SparkPreview, StarterPreview } from "./card-preview";
import { ScanVisual } from "./landing";

type Tab = { key: string; label: string; icon: LucideIcon; title: string; body: string; href: string; visual: ReactNode; tint: string };

// Scroll-through mode, on laptops and up with a tall enough window (the panel must fit under the header):
// the showcase sticks below the header and scrolling moves through the tabs, then the page carries on.
const SCROLL_QUERY = "(min-width: 1024px) and (min-height: 760px)";
const STICK_TOP = 88; // px, just under the sticky site header (5.5rem, as in Journey)
const STEP_VH = 55; // scroll distance per tab, in % of the window height

/** Shrinks its content (never grows it) so it fits the box's height; the box keeps one height for every tab. */
export function FitToBox({ children, watch }: { children: ReactNode; watch: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current;
      const i = inner.current;
      if (!b || !i) return;
      const room = b.clientHeight;
      const need = i.scrollHeight;
      setScale(need > room ? room / need : 1);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [watch]);
  return (
    <div ref={box} className="flex size-full items-center justify-center">
      <div ref={inner} className="flex w-full shrink-0 justify-center" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

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
  const keys = tabs.map((t) => t.key).join(",");

  // canScroll: the screen is big enough; closed: the visitor pressed X; pinned: stuck right now.
  const [canScroll, setCanScroll] = useState(false);
  const [closed, setClosed] = useState(false);
  const [stuck, setPinned] = useState(false);
  const scrollMode = canScroll && !closed;
  const pinned = scrollMode && stuck;
  const track = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const skipTo = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(SCROLL_QUERY);
    const update = () => setCanScroll(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // While pinned, how far you've scrolled through the spacer picks the tab.
  useEffect(() => {
    if (!scrollMode) return;
    const list = keys.split(",");
    const onScroll = () => {
      const el = track.current;
      const travel = spacer.current?.offsetHeight ?? 0;
      if (!el || !travel) return;
      const into = STICK_TOP - el.getBoundingClientRect().top;
      setPinned(into >= 0 && into <= travel);
      const i = Math.min(list.length - 1, Math.max(0, Math.floor((into / travel) * list.length)));
      setActive(list[i]);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scrollMode, keys]);

  // After X, the spacer is gone: jump to just past the showcase so the page carries on.
  useEffect(() => {
    const el = track.current;
    if (closed && skipTo.current !== null && el) {
      window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY - STICK_TOP + 24 });
      skipTo.current = null;
    }
  }, [closed]);

  function choose(key: string) {
    const el = track.current;
    const travel = spacer.current?.offsetHeight ?? 0;
    if (!scrollMode || !el || !travel) return setActive(key);
    // In scroll mode a tab click scrolls to that tab's stretch, so scrolling and tabs stay in step.
    const i = tabs.findIndex((t) => t.key === key);
    const start = el.getBoundingClientRect().top + window.scrollY - STICK_TOP;
    window.scrollTo({ top: start + ((i + 0.5) / tabs.length) * travel, behavior: "smooth" });
  }

  function close() {
    skipTo.current = 1; // measured after the showcase shrinks back, in the effect above
    setClosed(true);
  }

  return (
    // overflow-anchor: none, or the browser shifts the page when a taller tab appears and skips a tab.
    <div ref={track} className="relative [overflow-anchor:none]">
      <div
        className={cn(
          "rounded-[1.75rem] bg-gradient-to-br from-sage via-accent-soft to-clay p-2.5 sm:p-5",
          // Pinned (after Calendly's): the frame fills the screen under the header, the panel centred in it,
          // and widens to the edges of the hero sheet.
          scrollMode && "sticky z-10 flex flex-col items-center justify-center px-10! py-6! transition-[margin] duration-500 ease-out",
          pinned && "-mx-10 lg:-mx-16",
        )}
        style={scrollMode ? { top: STICK_TOP, height: `calc(100vh - ${STICK_TOP + 8}px)` } : undefined}
      >
      {pinned && (
        <button
          type="button"
          onClick={close}
          aria-label="Stop scrolling through features"
          title="Skip"
          className="absolute right-6 top-6 z-20 grid size-12 place-items-center rounded-xl bg-white/45 text-ink ring-1 ring-white/70 backdrop-blur-sm animate-fade-in hover:bg-white/70"
        >
          <X className="size-5" aria-hidden />
        </button>
      )}
      <div className={cn(scrollMode && "w-full max-w-6xl")}>
      {/* The tabs: icons on a pill, labels under them from tablets up. */}
      <div role="tablist" aria-label="Features" className="-mx-1 flex justify-start gap-2 overflow-x-auto px-1 pb-3 pt-1 sm:justify-center sm:pb-4">
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
              onClick={() => choose(t.key)}
              className={cn(
                // A 2px outline on every tab. Active: all brand green with white text and icon;
                // inactive: a subtle light green with a white outline.
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ring-2 transition-colors",
                // Active outline: a 200 shade of the brand green (#1f4d3f).
                on ? "bg-accent text-white shadow-sm ring-[#a9cdbd]" : "bg-accent-soft text-ink ring-white hover:bg-surface hover:text-ink",
              )}
            >
              {/* Active icon sits on a lighter green circle. */}
              <span className={cn("grid size-7 place-items-center rounded-full", on ? "bg-white/20 text-white" : "bg-surface text-ink-2")}>
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
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] items-center gap-6 rounded-[1.25rem] bg-surface p-4 sm:gap-8 sm:p-10 lg:grid-cols-2 lg:gap-14",
          scrollMode ? "lg:p-8" : "lg:p-12",
        )}
      >
        <div key={tab.key} className="motion-safe:animate-fade-in">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
            <tab.icon className="size-4" aria-hidden />
            {tab.label}
          </span>
          <h3 className="mt-4 font-display text-fluid-tab leading-[1.05] tracking-tight text-ink sm:mt-5">{tab.title}</h3>
          <p className="mt-3 max-w-md text-fluid-body leading-relaxed text-ink-2 sm:mt-4">{tab.body}</p>
          <Link href={tab.href} className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:text-accent-hover sm:mt-7">
            Learn more
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {scrollMode ? (
          // Pinned: one fixed height for every tab (so the panel fits the screen and never jumps),
          // with tall pictures scaled down to fit.
          <div className={cn("h-[28rem] overflow-hidden rounded-[1.25rem] p-6", tab.tint)}>
            <FitToBox watch={tab.key}>
              <div key={tab.key} className="flex w-full justify-center motion-safe:animate-fade-in">
                {tab.visual}
              </div>
            </FitToBox>
          </div>
        ) : (
          <div className={cn("flex min-h-[15rem] items-center justify-center overflow-hidden rounded-[1.25rem] p-3 sm:min-h-[26rem] sm:p-10", tab.tint)}>
            <div key={tab.key} className="flex w-full min-w-0 justify-center motion-safe:animate-fade-in">
              {tab.visual}
            </div>
          </div>
        )}
      </div>
      </div>
      </div>
      {/* The scroll distance that moves through the tabs; only in scroll mode. */}
      {scrollMode && <div ref={spacer} aria-hidden style={{ height: `${tabs.length * STEP_VH}vh` }} />}
    </div>
  );
}
