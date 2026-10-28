"use client";

import { Briefcase, GraduationCap, Lightbulb, Rocket, Ticket, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type UseCase = { icon: LucideIcon; title: string; body: string; more: string; tags: [string, string]; photo: string };

// Photos in public/landing: professional and founder from Unsplash, event from Pexels (free licences, no credit needed), the rest from Magnific (free licence,
// credit required: shown under the carousel; originals in brand/magnific). Stock people, never shown as members or quoted.
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
    photo: "/landing/founder-suit.webp",
  },
  {
    icon: Lightbulb,
    title: "Freelancers & creators",
    body: "Send new clients straight to your work.",
    more: "Your portfolio and socials are one scan away, and new clients save you in one tap.",
    tags: ["Links on your card", "One-tap save"],
    photo: "/landing/creator-vlog.webp",
  },
  {
    icon: Ticket,
    title: "Event attendees",
    body: "Swap details in seconds.",
    more: "Scan, save and follow up before the next talk starts. Speakers get their own badge QR.",
    tags: ["Badge QR", "Contacts"],
    photo: "/landing/event-phones.webp",
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

// Credit for the Magnific photos: [shown name, author page].
const MAGNIFIC_AUTHORS = [
  ["DC Studio", "dcstudio"],
  ["ASphotofamily", "asphotofamily"],
] as const;

const STEP_MS = 4500;

/**
 * "Made for people who meet people", after Calendly's customer stories: one
 * open card (a big photo with the words on it) and slim photo cards either side.
 * It moves to the next group every few seconds, so the row
 * slides left; hovering pauses it, and clicking a slim card opens it.
 */
export function UseCaseCarousel({ className, children }: { className?: string; children?: ReactNode }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % USE_CASES.length), STEP_MS);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div
      className={cn("relative overflow-hidden bg-gradient-to-br from-sage via-accent-soft to-clay py-10 sm:py-20", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* The heading, lined up with the page content above. */}
      {children && <div className="mx-auto mb-7 max-w-[90rem] px-6 sm:mb-12 sm:px-14 lg:px-20">{children}</div>}
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
              {open ? (
                // The photo fills the whole card; the words sit on a dark fade at the bottom.
                <article className="relative h-[21rem] w-[var(--open)] shrink-0 overflow-hidden rounded-[1.25rem] shadow-sm sm:h-[28rem] sm:rounded-[1.5rem]">
                  {/* Each photo has a wide crop for the open card next to the tall one: name-wide.webp. */}
                  <Image src={u.photo.replace(".webp", "-wide.webp")} alt="" fill sizes="(min-width: 768px) 46rem, 80vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 via-45% to-transparent" aria-hidden />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-8">
                    <span className="grid size-8 place-items-center rounded-full bg-white/15 backdrop-blur-sm sm:size-10">
                      <u.icon className="size-4 sm:size-5" aria-hidden />
                    </span>
                    <h3 className="mt-2.5 font-display text-fluid-photo leading-[1.05] tracking-tight sm:mt-3">{u.title}</h3>
                    <p className="mt-1 text-fluid-body font-medium sm:mt-1.5">{u.body}</p>
                    <p className="mt-1.5 max-w-xl text-fluid-xs leading-relaxed text-white/80 sm:mt-2">{u.more}</p>
                    <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5">
                      {u.tags.map((t) => (
                        <span key={t} className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">{t}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ) : (
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show ${u.title}`}
                  className="w-[var(--slim)] shrink-0 rounded-[1.25rem] bg-surface p-2 transition-transform hover:scale-[1.03]"
                >
                  <span className="relative block h-40 overflow-hidden rounded-[0.9rem] sm:h-64">
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
        Photos from Unsplash and Pexels, and by{" "}
        {MAGNIFIC_AUTHORS.map(([name, slug], i) => (
          <span key={slug}>
            {i > 0 && (i === MAGNIFIC_AUTHORS.length - 1 ? " and " : ", ")}
            <a href={`https://www.magnific.com/author/${slug}`} className="underline">{name}</a>
          </span>
        ))}{" "}
        on Magnific. AI-generated portraits by{" "}
        <a href="https://www.magnific.com" className="underline">Magnific</a>
      </p>
    </div>
  );
}
