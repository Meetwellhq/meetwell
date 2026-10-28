import { ArrowRight, BookUser, ChartLine, HandHeart, MessageSquareText, Mic, QrCode, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { FeaturePage, FeatureSlug } from "@/lib/features";
import { AutoScrollRow } from "./auto-scroll-row";
import { AnalyticsPreview, ContactsPreview, EventPreview, MentorPreview, SparkPreview, StarterPreview } from "./card-preview";
import { FitToBox } from "./feature-tabs";
import { ScanVisual } from "./landing";

const ICONS: Record<FeatureSlug, LucideIcon> = {
  "qr-card": QrCode,
  icebreaker: MessageSquareText,
  contacts: BookUser,
  spark: Sparkles,
  mentoring: HandHeart,
  analytics: ChartLine,
  events: Mic,
};

// The same illustrations as the landing page's feature tabs.
function illustration(slug: FeatureSlug, qrSvg: string): ReactNode {
  switch (slug) {
    case "qr-card":
      return <ScanVisual qrSvg={qrSvg} />;
    case "icebreaker":
      return (
        <div className="w-full max-w-md">
          <StarterPreview />
        </div>
      );
    case "contacts":
      return <ContactsPreview />;
    case "spark":
      return <SparkPreview />;
    case "mentoring":
      return <MentorPreview />;
    case "analytics":
      return <AnalyticsPreview />;
    case "events":
      return <EventPreview />;
  }
}

// One short, plain line per feature for the cards.
const BLURBS: Record<FeatureSlug, string> = {
  "qr-card": "One scan opens your card. No app, no typing.",
  icebreaker: "A ready-made first message, so people actually say hello.",
  contacts: "Everyone you meet, kept in one place with a note.",
  spark: "Meet someone a few steps ahead in your field.",
  mentoring: "Share what you know and get paid for it.",
  analytics: "See how many people viewed, scanned and saved your card.",
  events: "Your card on the speaker page and on your badge.",
};

/**
 * "More from Meetwell" on feature pages (after Calendly's product row): a small label, a heading,
 * then a row of cards that moves on by itself, each with the feature's landing page
 * illustration, its name, one short line and a link to that feature's page.
 */
export function MoreFeatures({ features, qrSvg }: { features: FeaturePage[]; qrSvg: string }) {
  return (
    <div>
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-accent">More from Meetwell</p>
        <h2 className="mx-auto mt-2 max-w-3xl font-display text-fluid-h2 leading-[1.05] tracking-tight text-ink">
          There&apos;s more to meeting people than one scan.
        </h2>
      </div>
      {/* Edge to edge inside the section, scrolling sideways; cards snap into place.
          Moves one card left every few seconds (AutoScrollRow). scroll-px: cards snap to the padded
          edge, lined up with the page, not the screen edge. */}
      <AutoScrollRow className="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-4 sm:-mx-10 sm:mt-14 sm:scroll-px-10 sm:gap-8 sm:px-10 lg:-mx-16 lg:scroll-px-16 lg:px-16">
        {features.map((f, i) => {
          const Icon = ICONS[f.slug];
          return (
            // The name and Learn more are the links; the illustration stays interactive (Mentoring has buttons).
            <li key={f.slug} className="w-[17.5rem] shrink-0 snap-start sm:w-[26rem]">
              <div className={cn("h-[17rem] overflow-hidden rounded-[1.25rem] p-4 sm:h-[26rem] sm:p-6", i % 2 ? "bg-clay" : "bg-sage")}>
                <FitToBox watch={f.slug}>{illustration(f.slug, qrSvg)}</FitToBox>
              </div>
              {/* Name under the picture, then one short line. */}
              <Link href={`/features/${f.slug}`} className="mt-5 inline-flex items-center gap-2.5 text-ink hover:text-accent">
                <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-ink">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="text-lg font-semibold">{f.name}</span>
              </Link>
              <p className="mt-2 text-fluid-body leading-relaxed text-ink-2">{BLURBS[f.slug]}</p>
              <Link
                href={`/features/${f.slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:text-accent-hover"
              >
                Learn more
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </li>
          );
        })}
      </AutoScrollRow>
    </div>
  );
}
