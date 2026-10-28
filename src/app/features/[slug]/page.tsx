import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AnalyticsPreview,
  CardPreview,
  ContactsPreview,
  EventPreview,
  MentorPreview,
  SparkPreview,
  StarterPreview,
} from "@/components/marketing/card-preview";
import { FeatureTabs } from "@/components/marketing/feature-tabs";
import { Journey, Panel } from "@/components/marketing/landing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink } from "@/components/ui/button";
import { getSiteUrl, isSupabaseConfigured, JOIN_CTA } from "@/lib/config";
import { FEATURES, featureBySlug, visibleFeatures, type FeatureSlug } from "@/lib/features";
import { isSparkOn } from "@/lib/spark";
import { qrSvg } from "@/lib/qr";
import { getCurrentUser } from "@/lib/supabase/server";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps<"/features/[slug]">): Promise<Metadata> {
  const feature = featureBySlug((await params).slug);
  return feature ? { title: feature.name, description: feature.intro } : { title: "Feature" };
}

async function isSignedIn() {
  if (!isSupabaseConfigured()) return false;
  try {
    return !!(await getCurrentUser());
  } catch {
    return false;
  }
}

function Visual({ slug, qr }: { slug: FeatureSlug; qr: string }) {
  switch (slug) {
    case "qr-card":
      return <CardPreview qrSvg={qr} />;
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

export default async function FeaturePage({ params }: PageProps<"/features/[slug]">) {
  const feature = featureBySlug((await params).slug);
  const spark = await isSparkOn();
  // The Spark page is hidden until Spark launches.
  if (!feature || (feature.slug === "spark" && !spark)) notFound();
  const signedIn = await isSignedIn();
  const cta = signedIn ? "/dashboard" : JOIN_CTA.href;
  const ctaLabel = signedIn ? "Go to your dashboard" : JOIN_CTA.label;
  // "More from Meetwell" opens on the feature after this one (wrapping round).
  const shown = visibleFeatures(spark);
  const next = shown[(shown.findIndex((f) => f.slug === feature.slug) + 1) % shown.length].slug;
  const qr = await qrSvg(getSiteUrl(), { margin: 1 });

  return (
    <div className="light-only flex min-h-full flex-col bg-surface">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-16 px-3 pb-3 sm:px-4 lg:gap-[100px]">
        <Panel>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-accent">{feature.name}</p>
              <h1 className="mt-4 font-display text-fluid-title leading-[1] tracking-tight text-ink">{feature.title}</h1>
              <p className="mt-6 max-w-lg text-fluid-lead leading-relaxed text-ink-2">{feature.intro}</p>
              <div className="mt-8">
                <ButtonLink href={cta} size="lg">
                  {ctaLabel}
                  <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </div>
            </div>
            <div className="relative flex min-h-[24rem] items-center justify-center overflow-hidden rounded-[1.25rem] bg-sage p-4 pb-20 sm:min-h-[28rem] sm:p-10 sm:pb-20">
              <Visual slug={feature.slug} qr={qr} />
            </div>
          </div>
        </Panel>

        {/* The landing page's stacking step cards, with this feature's own steps and an icon for each. */}
        <Panel className="bg-surface-2!">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wider text-accent">How it works</p>
            <h2 className="mt-2 font-display text-fluid-h2 leading-[1.05] tracking-tight text-ink">
              {feature.name} in three steps.
            </h2>
          </div>
          <div className="mt-7 sm:mt-10">
            <Journey
              moments={feature.steps.map((s, i) => ({
                title: s.title,
                body: s.body,
                steps: [],
                tint: i % 2 ? "bg-clay" : "bg-sage",
                visual: (
                  <span className="grid size-24 place-items-center rounded-[1.75rem] bg-surface shadow-md sm:size-28">
                    <s.icon className="size-10 text-accent sm:size-12" />
                  </span>
                ),
              }))}
            />
          </div>
        </Panel>

        <Panel>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <h2 className="font-display text-fluid-h2 leading-[1.05] tracking-tight text-ink">Good to know</h2>
            <ul className="flex flex-col gap-4">
              {feature.details.map((d) => (
                <li key={d} className="flex items-start gap-3 text-fluid-body leading-relaxed text-ink-2">
                  <Check className="mt-1 size-5 shrink-0 text-accent" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        {/* The landing page's feature tabs, opening on the next feature rather than this one. */}
        <Panel>
          <h2 className="text-center font-display text-fluid-h2 leading-[1.05] tracking-tight text-ink">More from Meetwell</h2>
          <div className="mt-8 sm:mt-12">
            <FeatureTabs qrSvg={qr} spark={spark} initial={next} />
          </div>
        </Panel>
      </main>
      <SiteFooter wide />
    </div>
  );
}
