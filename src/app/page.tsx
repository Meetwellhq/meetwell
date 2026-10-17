import { Briefcase, GraduationCap, Lightbulb, Rocket, Ticket } from "lucide-react";
import { CardPreview, StarterPreview } from "@/components/marketing/card-preview";
import { Feature, HighlightsStrip, Panel, Pill, ScanVisual } from "@/components/marketing/landing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/config";
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
  "Free to create",
  "No app needed to scan",
  "Works with any phone camera",
  "Save contact in one tap",
  "Update anytime — your QR code never changes",
  "Ready-to-send first messages",
];

const useCases = [
  { icon: Briefcase, title: "Professionals", body: "Designers, developers and other tech folks who want contacts that turn into conversations." },
  { icon: Rocket, title: "Founders", body: "Share what you're building and make it easy for collaborators and backers to reach out." },
  { icon: Lightbulb, title: "Freelancers & creators", body: "Point new clients to your work and make the first message effortless." },
  { icon: Ticket, title: "Event attendees", body: "Swap details at conferences, meetups and career fairs in the time it takes to say hello." },
  { icon: GraduationCap, title: "Students & job seekers", body: "Leave recruiters and mentors with a card they can actually act on." },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const [signedIn, qr, { deleted }] = await Promise.all([
    isSignedIn(),
    qrSvg(getSiteUrl(), { margin: 1 }),
    searchParams,
  ]);
  const cta = signedIn ? "/dashboard" : "/sign-up";
  const ctaLabel = signedIn ? "Go to your dashboard" : "Create your free card";

  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-3 px-3 pb-3 sm:px-4">
        {deleted && <Alert tone="success">Your account and card have been deleted.</Alert>}

        {/* Hero */}
        <Panel className="overflow-hidden border-0! px-0 pb-0 text-center sm:px-0 lg:px-0">
          <div className="px-5 sm:px-10">
            <h1 className="mx-auto max-w-4xl font-display text-[3.25rem] leading-[0.98] tracking-tight text-ink sm:text-7xl lg:text-[5.5rem]">
              Meet someone. {/* Instrument Serif has one weight; a hairline stroke gives a medium look. */}
              <span className="font-medium italic text-accent [-webkit-text-stroke:0.008em_currentColor]">Make it a connection.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              Your networking card, contact details and a ready-to-send first message — all in one scan. So the people
              you meet actually follow up.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={cta} size="lg" variant="secondary">
                {ctaLabel}
              </ButtonLink>
              <a href="#how-it-works" className={buttonClass({ size: "lg", variant: "secondary" })}>
                See how it works
              </a>
            </div>
          </div>

          <div className="mt-12">
            <HighlightsStrip items={highlights} />
          </div>

          <div className="mx-3 mt-12 flex min-h-[26rem] items-center justify-center rounded-[1.75rem] bg-accent px-6 pb-20 pt-14 sm:mx-10 sm:min-h-[32rem] lg:mx-16">
            <CardPreview qrSvg={qr} />
          </div>
          <div className="h-3 sm:h-10 lg:h-16" />
        </Panel>

        {/* Scan */}
        <Panel id="how-it-works">
          <Feature
            label="Scan"
            title={<>One scan. No app. No typing.</>}
            body={
              <p>
                Show your QR code and anyone can open your card with their phone camera — no download, no account, no
                form. Your code points to your profile link, so it never needs reprinting.
              </p>
            }
            action={<ButtonLink href={cta} variant="secondary">{ctaLabel}</ButtonLink>}
            visual={<ScanVisual qrSvg={qr} />}
            visualClassName="bg-sage"
          />
        </Panel>

        {/* Connect */}
        <Panel>
          <Feature
            reverse
            label="Start the conversation"
            title={<>Never stare at a blank message again.</>}
            body={
              <p>
                Visitors pick what they want — to network, learn, offer services or follow up — and get a short, natural
                draft based on your card. They edit it and send it from their own email or chat app. Drafts never invent
                shared history.
              </p>
            }
            action={<ButtonLink href={cta} variant="secondary">{ctaLabel}</ButtonLink>}
            visual={
              <div className="w-full max-w-md">
                <StarterPreview />
              </div>
            }
            visualClassName="bg-clay"
          />
        </Panel>

        {/* Use cases */}
        <Panel>
          <div className="max-w-2xl">
            <Pill tone="dark">Who it&apos;s for</Pill>
            <h2 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">
              Made for people who meet people.
            </h2>
          </div>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {useCases.map((u) => (
              <li key={u.title} className="rounded-[1.5rem] border border-border bg-white p-6">
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
        <section className="rounded-[2rem] bg-accent px-6 py-20 text-center text-white sm:py-28">
          <h2 className="mx-auto max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
            Your next connection is one scan away.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-white/75">Create a free card in a few minutes.</p>
          <div className="mt-9">
            <ButtonLink href={cta} size="lg" variant="secondary" className="border-transparent">
              {ctaLabel}
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter bordered={false} wide />
    </div>
  );
}
