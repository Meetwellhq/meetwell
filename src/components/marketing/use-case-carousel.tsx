"use client";

import { Briefcase, GraduationCap, Lightbulb, Rocket, Ticket, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
// Slim cards on each side of the open one (the rest of the five).
const SIDE = Math.floor(USE_CASES.length / 2);
const COUNT = USE_CASES.length;
const OPEN_SIZES = "(min-width: 768px) 46rem, 80vw";
// How the cards slide to their new places.
const SLIDE = { duration: 500, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };
const GAP_PX = 12;
const slotOf = (card: number, active: number) => (card - active + SIDE + COUNT) % COUNT;
// Hides everything outside a box of this size, keeping the left edge and the vertical middle.
const clipTo = (from: DOMRect, to: DOMRect) => {
  const y = Math.max(0, (to.height - from.height) / 2);
  return `inset(${y}px ${Math.max(0, to.width - from.width)}px ${y}px 0 round 1.25rem)`;
};

/**
 * "Made for people who meet people", after Calendly's customer stories: one
 * open card (a big photo with the words on it) and slim photo cards either side.
 * It moves to the next group every few seconds, so the row
 * slides left; hovering pauses it, and clicking a slim card opens it.
 * The cards swap places in the page at once; go() and the layout effect then
 * slide them from where they were, so nothing appears to jump.
 */
export function UseCaseCarousel({ className, children }: { className?: string; children?: ReactNode }) {
  // Starts on the middle photo, so there are slim cards on both sides.
  const [active, setActive] = useState(Math.floor(USE_CASES.length / 2));
  const [paused, setPaused] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  // Where every card was just before a move, and a copy of the open card to shrink away.
  const before = useRef<{ active: number; boxes: Map<number, DOMRect>; ghost: HTMLElement | null } | null>(null);

  const cards = () => [...(track.current?.querySelectorAll<HTMLElement>("[data-card]") ?? [])];

  function go(next: number) {
    if (next === active) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Tapped mid-slide: finish it first, or the cards' boxes won't match what's showing.
      track.current?.querySelectorAll("[data-ghost]").forEach((el) => el.remove());
      const all = cards();
      all.forEach((el) => el.getAnimations().forEach((a) => a.finish()));
      const open = all.find((el) => Number(el.dataset.card) === active);
      before.current = {
        active,
        boxes: new Map(all.map((el) => [Number(el.dataset.card), el.getBoundingClientRect()])),
        ghost: open ? (open.cloneNode(true) as HTMLElement) : null,
      };
    }
    setActive(next);
  }

  useLayoutEffect(() => {
    const was = before.current;
    const row = track.current;
    if (!was || !row) return;
    before.current = null;
    const all = cards();
    const rowBox = row.getBoundingClientRect();
    // Which way it moved: going forward by 1 or 2, or back by 1 or 2.
    const step = ((active - was.active + COUNT + SIDE) % COUNT) - SIDE;

    all.forEach((el) => {
      const card = Number(el.dataset.card);
      const from = was.boxes.get(card);
      if (!from) return;
      const to = el.getBoundingClientRect();
      const oldSlot = slotOf(card, was.active);
      const newSlot = slotOf(card, active);
      // A card going round from one end to the other comes in from past its end, rather than crossing the row.
      if (step > 0 ? newSlot > oldSlot : newSlot < oldSlot) {
        const past = Math.sign(step) * (to.width + GAP_PX);
        el.animate({ translate: [`${past}px 0`, "0 0"], opacity: [0, 1] }, SLIDE);
        return;
      }
      const dx = from.left - to.left;
      if (card === active) {
        el.animate({ translate: [`${dx}px 0`, "0 0"], clipPath: [clipTo(from, to), clipTo(to, to)] }, SLIDE);
      } else {
        el.animate({ translate: [`${dx}px 0`, "0 0"] }, SLIDE);
      }
      // The old open card: its copy shrinks onto the slim card it has become, then fades to reveal it.
      if (card === was.active && was.ghost) {
        const ghost = was.ghost;
        delete ghost.dataset.card;
        ghost.dataset.ghost = "";
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.cssText = `position:absolute;left:${from.left - rowBox.left}px;top:${from.top - rowBox.top}px;z-index:1;pointer-events:none`;
        row.append(ghost);
        const shrink = ghost.animate(
          {
            translate: ["0 0", `${to.left - from.left}px ${to.top + to.height / 2 - (from.top + from.height / 2)}px`],
            clipPath: [clipTo(from, from), clipTo(to, from)],
            opacity: [1, 1, 0],
            offset: [0, 0.7, 1],
          },
          { ...SLIDE, fill: "forwards" },
        );
        shrink.onfinish = () => ghost.remove();
      }
    });
  }, [active]);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => go((active + 1) % COUNT), STEP_MS);
    return () => clearTimeout(timer);
  });

  return (
    <div
      className={cn("relative overflow-hidden py-16 sm:py-28", className)}
      // The colour fades in from the white page at the top and back out at the bottom.
      style={{
        background:
          "linear-gradient(to bottom, var(--surface), transparent 22%, transparent 78%, var(--surface)), linear-gradient(to bottom right, var(--sage), var(--accent-soft), var(--clay))",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* The heading, lined up with the page content above. */}
      {children && <div className="mx-auto mb-7 max-w-[90rem] px-6 sm:mb-12 sm:px-14 lg:px-20">{children}</div>}
      {/* The track works like a loop: the open card always sits in the middle with the same number of
          slim cards either side (two and two), and the cards rotate round it as it moves on. */}
      <div
        ref={track}
        className="relative left-1/2 flex w-max items-center gap-3 [--open:min(80vw,46rem)] [--slim:4.5rem] sm:[--slim:6.5rem]"
        // Starts from the middle of the box; the slim cards before the open one shift the row left by their width plus the gap.
        style={{ transform: `translateX(calc(-1 * ${SIDE} * (var(--slim) + 0.75rem) - var(--open) / 2))` }}
      >
        {Array.from({ length: USE_CASES.length }, (_, slot) => (active - SIDE + slot + USE_CASES.length) % USE_CASES.length).map((i) => {
          const u = USE_CASES[i];
          const open = i === active;
          return (
            <div key={u.title} data-card={i} className="flex shrink-0 items-center">
              {open ? (
                // Same white 8px frame and corners as the slim cards; the photo fills the inside and the
                // words sit on a dark fade at the bottom.
                <article className="h-[21rem] w-[var(--open)] shrink-0 rounded-[1.25rem] bg-surface p-2 shadow-sm sm:h-[28rem]">
                  <div className="relative size-full overflow-hidden rounded-[0.9rem]">
                  {/* Each photo has a wide crop for the open card next to the tall one: name-wide.webp. */}
                  {/* Its slim photo, invisible, so it's ready when this card slides away. */}
                  <Image src={u.photo} alt="" fill sizes="7rem" className="opacity-0" />
                  <Image src={u.photo.replace(".webp", "-wide.webp")} alt="" fill sizes={OPEN_SIZES} className="object-cover" />
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
                  </div>
                </article>
              ) : (
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show ${u.title}`}
                  className="w-[var(--slim)] shrink-0 rounded-[1.25rem] bg-surface p-2 transition-transform hover:scale-[1.03]"
                >
                  <span className="relative block h-40 overflow-hidden rounded-[0.9rem] sm:h-64">
                    {/* Its wide photo, invisible, so it's ready when this card opens. */}
                    <Image src={u.photo.replace(".webp", "-wide.webp")} alt="" fill sizes={OPEN_SIZES} className="opacity-0" />
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
            onClick={() => go(i)}
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
