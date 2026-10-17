import {
  BadgeCheck,
  Briefcase,
  EyeOff,
  Lightbulb,
  MessageSquareText,
  PenLine,
  Rocket,
  ScanLine,
  Send,
  Ticket,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { CardPreview, StarterPreview } from "@/components/marketing/card-preview";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink } from "@/components/ui/button";
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

const steps = [
  {
    icon: PenLine,
    title: "Create",
    body: "Add your role, a short bio, how to reach you and what you're open to. Choose exactly which details are public.",
  },
  {
    icon: ScanLine,
    title: "Scan",
    body: "Show your QR code. Anyone can scan it with their phone camera — no app, no account, no form.",
  },
  {
    icon: Send,
    title: "Connect",
    body: "They save your contact in one tap, open your links, and get a suggested message to start the conversation.",
  },
];

const useCases = [
  { icon: Briefcase, title: "Professionals", body: "Designers, developers and other tech folks who want contacts that turn into conversations." },
  { icon: Rocket, title: "Founders", body: "Share what you're building and make it easy for collaborators and investors to reach out." },
  { icon: Lightbulb, title: "Freelancers & creators", body: "Point new clients to your work and make the first message effortless." },
  { icon: Ticket, title: "Event attendees", body: "Swap details at conferences, meetups and career fairs in the time it takes to say hello." },
];

const privacyPoints = [
  { icon: EyeOff, title: "Every field has a switch", body: "Phone, email, website and each social link can be public or private." },
  { icon: BadgeCheck, title: "Private stays private", body: "Private details never reach the public page, its code or the downloadable contact card." },
  { icon: Trash2, title: "Unpublish any time", body: "Take your card offline instantly or delete it for good. Your QR code stops working with it." },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const [signedIn, qr, { deleted }] = await Promise.all([isSignedIn(), qrSvg(getSiteUrl(), { margin: 1 }), searchParams]);
  const cta = signedIn ? "/dashboard" : "/sign-up";

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main className="flex-1">
        {deleted && (
          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
            <Alert tone="success">Your account and card have been deleted.</Alert>
          </div>
        )}

        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-16 px-4 pb-24 pt-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-ink-2">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              Free digital networking card
            </p>
            <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Meet someone.
              <br />
              Make it a <span className="font-display font-normal italic text-accent">connection.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
              Your networking card, contact details and conversation starters — all accessible with one scan. So the
              people you meet actually follow up.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={cta} size="lg">
                {signedIn ? "Go to your dashboard" : "Create your card"}
              </ButtonLink>
              <ButtonLink href="#how-it-works" size="lg" variant="secondary">
                See how it works
              </ButtonLink>
            </div>
          </div>
          <div className="pb-16">
            <CardPreview qrSvg={qr} />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Scan. Discover. Connect. Follow up.</h2>
            <p className="mt-3 max-w-xl text-ink-2">Three steps from &ldquo;nice to meet you&rdquo; to a real conversation.</p>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-mono text-sm text-ink-3">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Conversation starters */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 md:grid-cols-2">
          <div>
            <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
              <MessageSquareText className="size-5" aria-hidden />
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Never stare at a blank message again.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              Visitors pick what they want — to collaborate, learn, offer services or simply follow up — and get a short,
              natural draft based on your profile. They can edit it, then copy it into email or any messaging app.
            </p>
            <p className="mt-4 text-ink-2">
              Drafts only use what&apos;s on your public card. They never invent shared history or details about you.
            </p>
          </div>
          <StarterPreview />
        </section>

        {/* Use cases */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Made for people who meet people.</h2>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map((u) => (
                <li key={u.title} className="rounded-2xl border border-border bg-bg p-6">
                  <u.icon className="size-5 text-accent" aria-hidden />
                  <h3 className="mt-4 font-semibold">{u.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{u.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">You decide what people see.</h2>
            <p className="mt-3 text-lg text-ink-2">
              Your QR code points to your profile link — not your raw contact details — so you can update or hide
              anything without reprinting it.
            </p>
          </div>
          <ul className="mt-12 grid gap-8 md:grid-cols-3">
            {privacyPoints.map((p) => (
              <li key={p.title}>
                <p.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-4 font-semibold">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-[2rem] bg-accent px-6 py-14 text-accent-ink sm:px-12 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Your next connection is one scan away.</h2>
              <p className="mt-2 text-white/75">Create a free card in a few minutes.</p>
            </div>
            <ButtonLink href={cta} size="lg" variant="secondary" className="border-transparent" icon={<UserRoundPlus className="size-5" />}>
              {signedIn ? "Open dashboard" : "Create your free card"}
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
