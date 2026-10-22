import {
  ArrowRight,
  BookUser,
  Briefcase,
  Camera,
  Gift,
  GraduationCap,
  Lightbulb,
  MessageSquareText,
  QrCode,
  Rocket,
  Smartphone,
  Sparkles,
  Ticket,
  UserRoundPlus,
  Wallet,
} from "lucide-react";
import { BetaBanner } from "@/components/marketing/beta-banner";
import { ContactsPreview, MentorPreview, SparkPreview, StarterPreview } from "@/components/marketing/card-preview";
import { HeroPhoto } from "@/components/marketing/hero-photo";
import { Feature, HighlightsStrip, Panel, ScanVisual } from "@/components/marketing/landing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { getSiteUrl, isSupabaseConfigured, JOIN_CTA, SIGNUPS_OPEN } from "@/lib/config";
import { qrSvg } from "@/lib/qr";
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
];

const useCases = [
  { icon: Briefcase, title: "Professionals", body: "Turn new contacts into real conversations." },
  { icon: Rocket, title: "Founders", body: "Share what you're building." },
  { icon: Lightbulb, title: "Freelancers & creators", body: "Send new clients straight to your work." },
  { icon: Ticket, title: "Event attendees", body: "Swap details in seconds." },
  { icon: GraduationCap, title: "Students & job seekers", body: "Give recruiters a card they can use." },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const [signedIn, qr, { deleted }] = await Promise.all([
    isSignedIn(),
    qrSvg(getSiteUrl(), { margin: 1 }),
    searchParams,
  ]);
  const cta = signedIn ? "/dashboard" : JOIN_CTA.href;
  const ctaLabel = signedIn ? "Go to your dashboard" : JOIN_CTA.label;

  return (
    <div className="flex min-h-full flex-col bg-white">
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
            </div>
          </div>

          <div className="mt-12">
            <HighlightsStrip items={highlights} />
          </div>

          {/* Phone illustration below the text; hidden on mobile. */}
          <div className="mx-3 mt-12 hidden sm:mx-10 sm:block lg:mx-16">
            <HeroPhoto />
          </div>
          <div className="h-3 sm:h-10 lg:h-16" />
        </Panel>

        {/* Scan */}
        <Panel id="how-it-works">
          <Feature
            title={<>One scan. No app. No typing.</>}
            body={
              <p>
                People scan your code with their camera and your card opens. Nothing to install.
              </p>
            }
            action={<ButtonLink href={cta}>
                {ctaLabel}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>}
            visual={<ScanVisual qrSvg={qr} />}
            visualClassName="bg-sage"
          />
        </Panel>

        {/* Connect */}
        <Panel>
          <Feature
            reverse
            title={<>Never stare at a blank message again.</>}
            body={
              <p>
                Visitors get a short first message based on your card, ready to edit and send.
              </p>
            }
            action={<ButtonLink href={cta}>
                {ctaLabel}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>}
            visual={
              <div className="w-full max-w-md">
                <StarterPreview />
              </div>
            }
            visualClassName="bg-clay"
          />
        </Panel>

        {/* Contacts */}
        <Panel>
          <Feature
            title={<>Every card you scan, kept.</>}
            body={
              <p>
                Everyone you meet lands in your Contacts, with a note on where you met. Save one to your phone, or
                export them all. See who saved your card, and save them back.
              </p>
            }
            action={<ButtonLink href={cta}>
                {ctaLabel}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>}
            visual={<ContactsPreview />}
            visualClassName="bg-sage"
          />
        </Panel>

        {/* Spark */}
        <Panel>
          <Feature
            reverse
            title={<>Meet people a few steps ahead.</>}
            body={
              <p>
                Spark uses AI to introduce you to someone with more experience in your field, and tells you why
                you should talk. Up to 5 free introductions a month.
              </p>
            }
            action={<ButtonLink href={cta}>
                {ctaLabel}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>}
            visual={<SparkPreview />}
            visualClassName="bg-clay"
          />
        </Panel>

        {/* Mentoring */}
        <Panel>
          <Feature
            title={<>Get paid for what you know.</>}
            body={
              <p>
                With 4+ years of experience, you can become a mentor. Set your monthly price, answer messages from
                people earlier in their careers, and keep 80% of every payment.
              </p>
            }
            action={<ButtonLink href={cta}>
                {ctaLabel}
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>}
            visual={<MentorPreview />}
            visualClassName="bg-sage"
          />
        </Panel>

        {/* Use cases */}
        <Panel>
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">
              Made for people who meet people.
            </h2>
          </div>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {useCases.map((u) => (
              <li key={u.title} className="rounded-[1rem] border border-border bg-white p-6">
                <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
                  <u.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-semibold text-ink">{u.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{u.body}</p>
              </li>
            ))}
          </ul>
        </Panel>

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
      <SiteFooter bordered={false} wide />
    </div>
  );
}
