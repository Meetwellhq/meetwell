import {
  ArrowRight,
  BookUser,
  ChartLine,
  Camera,
  Check,
  EyeOff,
  IdCard,
  Gift,
  MessageSquareText,
  Mic,
  QrCode,
  Repeat,
  ScanLine,
  Smartphone,
  Sparkles,
  UserRoundPlus,
  Wallet,
} from "lucide-react";
import { BetaBanner } from "@/components/marketing/beta-banner";
import { DemoVideoButton } from "@/components/marketing/demo-video-button";
import { FeatureTabs } from "@/components/marketing/feature-tabs";
import { UseCaseCarousel } from "@/components/marketing/use-case-carousel";
import { HighlightsStrip, Journey, Panel } from "@/components/marketing/landing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { getSiteUrl, isSupabaseConfigured, JOIN_CTA, SIGNUPS_OPEN } from "@/lib/config";
import { qrSvg } from "@/lib/qr";
import { isSparkOn } from "@/lib/spark";
import { getCurrentUser } from "@/lib/supabase/server";

async function isSignedIn() {
  if (!isSupabaseConfigured()) return false;
  try {
    return !!(await getCurrentUser());
  } catch {
    return false;
  }
}

// Product facts only — no invented stats, ratings or customer names.
const highlights = [
  { icon: Gift, label: "Free to use" },
  { icon: Smartphone, label: "No app needed" },
  { icon: Camera, label: "Any phone camera" },
  { icon: UserRoundPlus, label: "One-tap save" },
  { icon: QrCode, label: "Permanent QR code" },
  { icon: MessageSquareText, label: "Ready-made messages" },
  { icon: BookUser, label: "Contacts in one place" },
  { icon: Sparkles, label: "AI introductions" },
  { icon: Wallet, label: "Get paid to mentor" },
  { icon: ChartLine, label: "Card analytics" },
  { icon: Mic, label: "Event speaker pages" },
];


// Before, during and after you meet. The small pictures are illustrations, not real people.
const moments = [
  {
    title: "Before you go",
    body: "Make your card once. It's yours to share anywhere.",
    steps: [
      { icon: IdCard, text: "Add your photo, title and links" },
      { icon: EyeOff, text: "Choose what's public and what stays private" },
      { icon: QrCode, text: "Get a QR code that never changes" },
    ],
    visual: (
      <span className="flex w-full max-w-[20rem] items-center gap-3.5 rounded-2xl bg-surface p-5 shadow-md">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-semibold text-accent">AO</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Amara Okafor</span>
          <span className="block truncate text-xs text-ink-2">Product Designer · Studio North</span>
        </span>
        <QrCode className="size-8 shrink-0 text-ink" />
      </span>
    ),
    tint: "bg-sage",
  },
  {
    title: "When you meet",
    body: "They scan your code with their camera. No app, no typing.",
    steps: [
      { icon: ScanLine, text: "Your card opens on their phone" },
      { icon: UserRoundPlus, text: "They save you to their contacts in one tap" },
      { icon: BookUser, text: "Signed in? They land in your Contacts too" },
    ],
    visual: (
      <span className="flex w-full max-w-[20rem] flex-col gap-2">
        <span className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink shadow-md">
          <Check className="size-4 text-accent" />
          Contact saved
        </span>
        <span className="ml-6 flex items-center gap-2 rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink shadow-md">
          <BookUser className="size-4 text-accent" />
          Added to Contacts
        </span>
      </span>
    ),
    tint: "bg-clay",
  },
  {
    title: "After the event",
    body: "The part that usually gets lost. Meetwell makes it easy.",
    steps: [
      { icon: MessageSquareText, text: "Icebreaker drafts their first message to you" },
      { icon: ChartLine, text: "See how many people viewed and saved you" },
      { icon: Repeat, text: "See who saved your card, and save them back" },
    ],
    visual: (
      <span className="w-full max-w-[20rem] rounded-2xl rounded-bl-md bg-surface p-5 text-[15px] leading-relaxed text-ink shadow-md">
        Hi Amara, great meeting you at Design Day. I&apos;d love to hear how your team runs research.
      </span>
    ),
    tint: "bg-sage",
  },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const [signedIn, qr, { deleted }, spark] = await Promise.all([
    isSignedIn(),
    qrSvg(getSiteUrl(), { margin: 1 }),
    searchParams,
    isSparkOn(),
  ]);
  const cta = signedIn ? "/dashboard" : JOIN_CTA.href;
  const ctaLabel = signedIn ? "Go to your dashboard" : JOIN_CTA.label;

  return (
    // overflow-x-clip: the full-width carousel can reach the screen edges without a sideways scroll (and sticky cards still work).
    <div className="flex min-h-full flex-col overflow-x-clip bg-surface">
      {!SIGNUPS_OPEN && !signedIn && <BetaBanner />}
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-3 px-3 pb-3 sm:px-4">
        {deleted && <Alert tone="success">Your account and card have been deleted.</Alert>}

        {/* Hero */}
        <Panel className="overflow-hidden px-0 pb-0 sm:px-0 lg:px-0">
          <div className="px-5 text-center sm:px-10">
            <h1 className="mx-auto max-w-4xl font-display text-[3.25rem] leading-[0.98] tracking-tight text-ink sm:text-7xl lg:text-[5.5rem]">
              Meet someone. {/* Instrument Serif has one weight; a hairline stroke gives a medium look. */}
              <span className="font-medium italic text-accent [-webkit-text-stroke:0.008em_currentColor]">Make it a connection.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              Share your card with one scan. Make it easy for people to follow up.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={cta} size="lg">
                {ctaLabel}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <DemoVideoButton />
            </div>
            <p className="mt-4 text-sm text-ink-3">Free · No app needed · Works with any phone camera</p>
          </div>

          <div className="mt-12">
            <HighlightsStrip items={spark ? highlights : highlights.filter((h) => h.label !== "AI introductions")} />
          </div>

          {/* Every feature in one tabbed showcase (Calendly-style), right under the hero text. */}
          <div id="how-it-works" className="mx-3 mt-12 scroll-mt-20 sm:mx-10 lg:mx-16">
            <FeatureTabs qrSvg={qr} spark={spark} />
          </div>
          <div className="h-3 sm:h-10 lg:h-16" />
        </Panel>

        {/* Before, during and after you meet: white cards stacking on light grey. */}
        <Panel className="relative z-10 bg-surface-2!">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-accent">How it works</p>
            <h2 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">
              From first hello to follow-up.
            </h2>
          </div>
          <div className="mt-10">
            <Journey moments={moments} />
          </div>
          <div className="mt-10">
            <ButtonLink href={cta}>
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </Panel>

        {/* Use cases */}
        {/* Full width, heading inside the colour; tucked under the panel above (-mt-9) so its rounded corners sit on it. */}
        <section className="relative left-1/2 -mt-9 w-screen -translate-x-1/2">
          <UseCaseCarousel className="pt-23! sm:pt-29!">
            <h2 className="text-center font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">
              Made for people who meet people.
            </h2>
          </UseCaseCarousel>
        </section>

        {/* Final CTA */}
        <section className="rounded-[1.5rem] bg-accent px-6 py-20 text-center text-white sm:py-28">
          <h2 className="mx-auto max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
            Your next connection is one scan away.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-white/75">
            {SIGNUPS_OPEN ? "Create a free card in a few minutes." : "We're letting people in slowly."}
          </p>
          <div className="mt-9">
            <ButtonLink href={cta} size="lg" variant="secondary" className="border-transparent">
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter wide />
    </div>
  );
}
