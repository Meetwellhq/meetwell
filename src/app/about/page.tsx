import { ArrowRight, BookUser, MessageSquareText, QrCode, Sparkles, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { SocialIcon } from "@/components/icons/social-icon";
import { Panel } from "@/components/marketing/landing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink } from "@/components/ui/button";
import { APP_NAME, COMPANY_NAME, COMPANY_RC, isSupabaseConfigured, INFO_EMAIL, JOIN_CTA, SOCIAL_LINKS, SUPPORT_EMAIL } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSparkOn } from "@/lib/spark";

export const metadata: Metadata = {
  title: "About",
  description: `Why we're building ${APP_NAME}, and who's behind it.`,
};

async function isSignedIn() {
  if (!isSupabaseConfigured()) return false;
  try {
    return !!(await getCurrentUser());
  } catch {
    return false;
  }
}

const whatWeDo = [
  { icon: QrCode, title: "A card with its own QR code", body: "People scan it with their camera and save you in one tap. No app needed." },
  { icon: MessageSquareText, title: "Icebreaker", body: "Visitors get a ready-made first message based on your card, so following up is easy." },
  { icon: BookUser, title: "Contacts in one place", body: "Every card you scan is kept, with a note on where you met." },
  { icon: Sparkles, title: "Spark introductions", body: "AI introduces you to someone a few steps ahead in your field." },
  { icon: Wallet, title: "Paid mentoring", body: "People with 4+ years can set a monthly price and keep 80%." },
];

export default async function AboutPage() {
  const [signedIn, spark] = await Promise.all([isSignedIn(), isSparkOn()]);
  // Spark is left out until it launches.
  const offer = spark ? whatWeDo : whatWeDo.filter((w) => w.title !== "Spark introductions");
  const cta = signedIn ? "/dashboard" : JOIN_CTA.href;
  const ctaLabel = signedIn ? "Go to your dashboard" : JOIN_CTA.label;
  const socials = SOCIAL_LINKS.filter((s) => s.url);

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-3 px-3 pb-3 sm:px-4">
        {/* Intro */}
        <Panel className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">About {APP_NAME}</p>
          <h1 className="mx-auto mt-4 max-w-4xl font-display text-5xl leading-[1] tracking-tight text-ink sm:text-7xl">
            Good meetings shouldn&apos;t end at <span className="italic text-accent">hello.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
            You meet someone great at an event. You swap numbers, or a handle, or nothing at all. A week later
            you&apos;ve forgotten their name. {APP_NAME} is here so that doesn&apos;t happen.
          </p>
        </Panel>

        {/* Why */}
        <Panel>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">
              Why we&apos;re building it
            </h2>
            <div className="space-y-4 text-[17px] leading-relaxed text-ink-2">
              <p>
                Most careers grow through people: the senior designer who reviews your portfolio, the founder who
                remembers you, the friend of a friend who knows about the job. But the tools for meeting people
                are either paper cards that get lost, or apps the other person has to install first.
              </p>
              <p>
                {APP_NAME} keeps it simple. Your card opens with any phone camera, saves in one tap, and comes
                with a first message so the follow-up actually happens. Then it helps you meet the people who can
                move your career forward, and lets experienced people get paid for their time.
              </p>
            </div>
          </div>
        </Panel>

        {/* What */}
        <Panel>
          <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">What {APP_NAME} does</h2>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {offer.map((w) => (
              <li key={w.title} className="rounded-[1rem] border border-border bg-surface p-6">
                <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
                  <w.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-semibold text-ink">{w.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{w.body}</p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Founder */}
        <Panel>
          <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
            <Image
              src="/founder/rasheed-about.webp"
              alt="Abdur-rasheed Idris, founder of Meetwell"
              width={240}
              height={240}
              className="size-40 rounded-full object-cover sm:size-56"
            />
            <div>
              <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">Built in Lagos</h2>
              <div className="mt-5 max-w-2xl space-y-4 text-[17px] leading-relaxed text-ink-2">
                <p>
                  I&apos;m Rasheed, a design engineer and the founder of {APP_NAME}. Almost every step in my
                  career came from someone I met, or someone who mentioned my name. But it rarely felt easy. I
                  spent many events trying to make the right impression, and just as many walking away with a
                  polite no.
                </p>
                <p>
                  I learned that a saved number isn&apos;t a relationship. People don&apos;t always reply, and
                  they won&apos;t always remember you when an opportunity comes up. Messages to the people who
                  could change your path often go unanswered. {APP_NAME} is built to fix that: to turn a quick
                  hello into a connection that helps both people grow.
                </p>
                <p>
                  We&apos;re in private beta and letting people in slowly, so every early member gets a good
                  experience. If you try it, I&apos;d love to hear what you think. Every email to{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline">
                    {SUPPORT_EMAIL}
                  </a>{" "}
                  gets read.
                </p>
              </div>
              <p className="mt-5 font-medium text-ink">Abdur-rasheed Idris, Founder</p>
            </div>
          </div>
        </Panel>

        {/* Company and contact */}
        <Panel>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">The company</h2>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-2">
                {APP_NAME} is run by {COMPANY_NAME} ({COMPANY_RC}), a company registered in Nigeria with the
                Corporate Affairs Commission in October 2026.
              </p>
            </div>
            <div>
              <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">Say hello</h2>
              <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
                Questions, ideas or feedback:{" "}
                <a href={`mailto:${INFO_EMAIL}`} className="text-accent underline">
                  {INFO_EMAIL}
                </a>
              </p>
              {socials.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <li key={s.platform}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-ink-2 transition-colors hover:border-border-strong hover:text-ink"
                      >
                        <SocialIcon platform={s.platform} className="size-4" />
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        {/* CTA */}
        <section className="rounded-[1.5rem] bg-accent px-6 py-20 text-center text-white sm:py-24">
          <h2 className="mx-auto max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            Make your next meeting count.
          </h2>
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
