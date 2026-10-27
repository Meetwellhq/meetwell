import { ArrowUpRight, CalendarDays, Download, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { APP_NAME, isSupabaseConfigured } from "@/lib/config";
import { eventCardPath, eventDates, eventQrTarget } from "@/lib/events";
import { getPublicEvent } from "@/lib/events-queries";
import { nairaFull } from "@/lib/format";
import { qrSvg } from "@/lib/qr";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = isSupabaseConfigured() ? await getPublicEvent(slug) : null;
  if (!found) return { title: "Event not found" };
  const { event } = found;
  const description = `Meet the speakers at ${event.name}, ${eventDates(event.startsOn, event.endsOn)}. Save their cards and keep in touch on ${APP_NAME}.`;
  return { title: event.name, description, openGraph: { title: event.name, description } };
}

export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) notFound();
  const found = await getPublicEvent(slug);
  if (!found) notFound();
  const { event, speakers } = found;
  const [signedIn, qr] = await Promise.all([
    getCurrentUser().then((u) => !!u).catch(() => false),
    qrSvg(eventQrTarget(event.slug)),
  ]);

  return (
    <div className="light-only flex min-h-full flex-col bg-surface-2">
      <SiteHeader signedIn={signedIn} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
        <section className="grid gap-8 rounded-[1.5rem] bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-wider text-accent">{event.partnerName}</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-6xl">{event.name}</h1>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-ink-2">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4 text-accent" aria-hidden />
                {eventDates(event.startsOn, event.endsOn)}
              </span>
              {event.venue && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4 text-accent" aria-hidden />
                  {event.venue}
                </span>
              )}
            </div>
            {event.about && <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">{event.about}</p>}
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4 text-center lg:w-56">
            <div className="size-40 [&>svg]:size-full" aria-label={`QR code for ${event.name}`} role="img" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="text-sm text-[#57554f]">Scan to see every speaker</p>
            <a href={`/e/${event.slug}/qr`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1f4d3f] hover:underline">
              <Download className="size-4" aria-hidden />
              Download for slides
            </a>
          </div>
        </section>

        <section className="rounded-[1.5rem] bg-surface p-6 sm:p-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">Speakers</h2>
            <p className="text-sm text-ink-2">
              {speakers.length} {speakers.length === 1 ? "speaker" : "speakers"} · save their cards and keep in touch
            </p>
          </div>

          {speakers.length === 0 ? (
            <p className="mt-6 text-ink-2">Speakers will appear here soon.</p>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {speakers.map((s) => (
                <li key={s.slug} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center gap-4">
                    <Avatar name={s.fullName} src={s.avatarUrl} className="size-16 shrink-0 text-xl" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{s.fullName}</p>
                      {(s.title || s.organization) && (
                        <p className="line-clamp-2 text-sm text-ink-2">{[s.title, s.organization].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  </div>
                  {s.priceKobo !== null && (
                    <p className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                      <MessageCircle className="size-3.5" aria-hidden />
                      Mentor · {s.priceKobo === 0 ? "free messages" : `${nairaFull(s.priceKobo)}/month`}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <Link href={eventCardPath(s.slug, event.slug)} className={buttonClass({ size: "sm" })}>
                      View card
                      <ArrowUpRight className="size-4" aria-hidden />
                    </Link>
                    <a
                      href={`/e/${event.slug}/qr?speaker=${encodeURIComponent(s.slug)}`}
                      className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink"
                    >
                      <Download className="size-3.5" aria-hidden />
                      Badge QR
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col items-center gap-4 rounded-[1.5rem] bg-accent px-6 py-12 text-center text-white">
          <h2 className="max-w-2xl font-display text-3xl tracking-tight sm:text-4xl">Met someone great at {event.name}?</h2>
          <p className="max-w-xl text-white/85">
            {APP_NAME} gives you a card with its own QR code, so the people you meet can save you in one tap.
          </p>
          <Link href={signedIn ? "/dashboard" : "/early-access"} className={buttonClass({ variant: "secondary", size: "lg", className: "border-transparent" })}>
            {signedIn ? "Go to your dashboard" : "Get your own card"}
          </Link>
        </section>
      </main>
      <SiteFooter wide />
    </div>
  );
}
