import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CardPreview,
  ContactsPreview,
  MentorPreview,
  SparkPreview,
  StarterPreview,
} from "@/components/marketing/card-preview";
import { Panel } from "@/components/marketing/landing";
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

async function Visual({ slug }: { slug: FeatureSlug }) {
  switch (slug) {
    case "qr-card":
      return <CardPreview qrSvg={await qrSvg(getSiteUrl(), { margin: 1 })} />;
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
  const others = visibleFeatures(spark).filter((f) => f.slug !== feature.slug);

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-3 px-3 pb-3 sm:px-4">
        <Panel>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-accent">{feature.name}</p>
              <h1 className="mt-4 font-display text-5xl leading-[1] tracking-tight text-ink sm:text-6xl">{feature.title}</h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">{feature.intro}</p>
              <div className="mt-8">
                <ButtonLink href={cta} size="lg">
                  {ctaLabel}
                  <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              </div>
            </div>
            <div className="relative flex min-h-[24rem] items-center justify-center overflow-hidden rounded-[1.25rem] bg-sage p-6 pb-20 sm:min-h-[28rem] sm:p-10 sm:pb-20">
              <Visual slug={feature.slug} />
            </div>
          </div>
        </Panel>

        <Panel>
          <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">How it works</h2>
          <ol className="mt-10 grid gap-3 md:grid-cols-3">
            {feature.steps.map((s, i) => (
              <li key={s.title} className="rounded-[1rem] border border-border bg-surface p-6">
                <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-5 font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">Good to know</h2>
            <ul className="flex flex-col gap-4">
              {feature.details.map((d) => (
                <li key={d} className="flex items-start gap-3 text-[17px] leading-relaxed text-ink-2">
                  <Check className="mt-1 size-5 shrink-0 text-accent" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <h2 className="font-display text-3xl leading-[1.05] tracking-tight text-ink sm:text-4xl">More from Meetwell</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/features/${f.slug}`}
                  className="flex h-full flex-col rounded-[1rem] border border-border bg-surface p-6 transition-colors hover:border-border-strong"
                >
                  <span className="font-semibold text-ink">{f.name}</span>
                  <span className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">{f.title}</span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                    Learn more <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
      <SiteFooter wide />
    </div>
  );
}
