"use client";

import { Briefcase, GraduationCap, Lightbulb, Rocket, Ticket, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type UseCase = { icon: LucideIcon; title: string; body: string; more: string; tags: [string, string]; photo: string };

// Photos in public/landing: Unsplash (free licence), except founder and student from Magnific (free licence,
// credit required: shown under the carousel). Stock people, never shown as members or quoted.
const USE_CASES: UseCase[] = [
  {
    icon: Briefcase,
    title: "Professionals",
    body: "Turn new contacts into real conversations.",
    more: "Everyone you meet is kept with a note on where you met, so no follow-up slips.",
    tags: ["Contacts", "Icebreaker"],
    photo: "/landing/professional.webp",
  },
  {
    icon: Rocket,
    title: "Founders",
    body: "Share what you're building.",
    more: "Your card links to your product, and your analytics show who opened it after a pitch.",
    tags: ["QR card", "Analytics"],
    photo: "/landing/founder-blazer.webp",
  },
  {
    icon: Lightbulb,
    title: "Freelancers & creators",
    body: "Send new clients straight to your work.",
    more: "Your portfolio and socials are one scan away, and new clients save you in one tap.",
    tags: ["Links on your card", "One-tap save"],
    photo: "/landing/creator.webp",
  },
  {
    icon: Ticket,
    title: "Event attendees",
    body: "Swap details in seconds.",
    more: "Scan, save and follow up before the next talk starts. Speakers get their own badge QR.",
    tags: ["Badge QR", "Contacts"],
    photo: "/landing/event.webp",
  },
  {
    icon: GraduationCap,
    title: "Students & job seekers",
    body: "Give recruiters a card they can use.",
    more: "Recruiters save your contact on the spot, and people a few years ahead are a message away.",
    tags: ["QR card", "Mentoring"],
    photo: "/landing/students-campus.webp",
  },
];

const STEP_MS = 4500;

/**
 * "Made for people who meet people", after Calendly's customer stories: one
 * open card (words and a big photo), slim photo cards either side, linked by
 * small connectors. It moves to the next group every few seconds, so the row
 * slides left; hovering pauses it, and clicking a slim card opens it.
 */
export function UseCaseCarousel({ children }: { children?: ReactNode }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % USE_CASES.length), STEP_MS);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="relative overflow-hidden bg-gradient-to-br from-sage via-accent-soft to-clay py-14 sm:py-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* The heading, lined up with the page content above. */}
      {children && <div className="mx-auto mb-10 max-w-[90rem] px-8 sm:mb-12 sm:px-14 lg:px-20">{children}</div>}
      {/* The track: the open card sits in the middle; moving on slides everything left. */}
      <div
        className="relative left-1/2 flex w-max items-center gap-3 transition-transform duration-700 ease-out [--open:min(80vw,46rem)] [--slim:4.5rem] sm:[--slim:6.5rem]"
        // Starts from the middle of the box; each slim card before the open one shifts the row left by its width plus the gap.
        style={{ transform: `translateX(calc(-1 * ${active} * (var(--slim) + 0.75rem) - var(--open) / 2))` }}
      >
        {USE_CASES.map((u, i) => {
          const open = i === active;
          return (
            <div key={u.title} className="flex shrink-0 items-center">
              {i > 0 && <span className="-ml-3 mr-0 h-8 w-3 shrink-0 rounded-sm bg-surface/80" aria-hidden />}
              {open ? (
                <article className="grid w-[var(--open)] shrink-0 gap-5 rounded-[1.5rem] bg-surface p-4 shadow-sm sm:grid-cols-[1fr_15rem] sm:gap-6 sm:p-5 lg:grid-cols-[1fr_19rem]">
                  <div className="flex flex-col justify-between gap-6 p-1 sm:p-3">
                    <div>
                      <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
                        <u.icon className="size-5" aria-hidden />
                      </span>
                      <h3 className="mt-4 font-display text-3xl leading-[1.05] tracking-tight text-ink sm:text-4xl">{u.title}</h3>
                      <p className="mt-2 text-[17px] font-medium text-ink">{u.body}</p>
                    </div>
                    <div>
                      <p className="font-display text-xl leading-snug text-ink-2 sm:text-2xl">{u.more}</p>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {u.tags.map((t) => (
                          <span key={t} className="rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.1rem] sm:aspect-auto sm:h-[22rem] lg:h-[24rem]">
                    <Image src={u.photo} alt="" fill sizes="(min-width: 1024px) 19rem, (min-width: 640px) 15rem, 80vw" className="object-cover" />
                  </div>
                </article>
              ) : (
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show ${u.title}`}
                  className="w-[var(--slim)] shrink-0 rounded-[1.25rem] bg-surface p-2 transition-transform hover:scale-[1.03]"
                >
                  <span className="relative block h-48 overflow-hidden rounded-[0.9rem] sm:h-64">
                    <Image src={u.photo} alt="" fill sizes="7rem" className="object-cover" />
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Dots: which group is open; also a way to pick one. */}
      <div className="mt-6 flex justify-center gap-1.5">
        {USE_CASES.map((u, i) => (
          <button
            key={u.title}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Show ${u.title}`}
            aria-current={i === active ? "true" : undefined}
            className={cn("h-1.5 rounded-full transition-all", i === active ? "w-6 bg-accent" : "w-1.5 bg-surface")}
          />
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] text-ink-3">
        Photos from Unsplash, and by{" "}
        <a href="https://www.magnific.com/author/magnific" className="underline">magnific</a> and{" "}
        <a href="https://www.magnific.com/author/asphotofamily" className="underline">ASphotofamily</a> on Magnific
      </p>
    </div>
  );
}
