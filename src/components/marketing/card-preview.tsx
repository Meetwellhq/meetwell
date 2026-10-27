import { Globe, Mail, Phone, UserRoundPlus } from "lucide-react";
import { SocialIcon } from "@/components/icons/social-icon";
import { MentorFlow } from "./mentor-flow";

/** Illustrative example card for the landing page (not a real person). */
export function CardPreview({ qrSvg }: { qrSvg: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[22rem]" aria-label="Example networking card" role="img">
      <div className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(20_20_19/0.04),0_12px_32px_-12px_rgb(20_20_19/0.12)]">
        <div className="flex items-center gap-3.5">
          <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent">AO</div>
          <div>
            <p className="text-lg font-semibold leading-tight text-ink">Amara Okafor</p>
            <p className="text-sm text-ink-2">Product Designer · Studio North</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          Designing calm, useful software. Always up for a coffee chat about design systems.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">Open to networking</span>
        </div>
        <div className="mt-5 flex h-11 items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-medium text-accent-ink">
          <UserRoundPlus className="size-[18px]" aria-hidden />
          Save contact
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {[
            <Mail key="m" className="size-[18px]" aria-hidden />,
            <Phone key="p" className="size-[18px]" aria-hidden />,
            <SocialIcon key="l" platform="linkedin" className="size-[18px]" />,
            <Globe key="g" className="size-[18px]" aria-hidden />,
          ].map((icon, i) => (
            <div key={i} className="grid h-11 place-items-center rounded-xl border border-border text-ink-2">
              {icon}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-16 -right-2 w-28 rotate-3 rounded-2xl border border-border bg-surface p-2.5 shadow-[0_12px_32px_-12px_rgb(20_20_19/0.18)] sm:-right-10">
        <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wider text-ink-3">Scan to connect</p>
      </div>
    </div>
  );
}

/** Static illustration of the conversation starter for the landing page. */
export function StarterPreview() {
  const chips = ["Collaborate", "Learn from them", "Offer my services", "Follow up after meeting"];
  return (
    <div className="rounded-[1.25rem] border border-border bg-surface p-5" role="img" aria-label="Example conversation starter">
      <p className="text-sm font-semibold text-ink">Start a conversation</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <span
            key={c}
            className={
              i === 0
                ? "rounded-full border border-accent bg-accent px-3 py-1.5 text-sm text-accent-ink"
                : "rounded-full border border-border-strong px-3 py-1.5 text-sm text-ink-2"
            }
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border-strong bg-bg px-3.5 py-3 text-[15px] leading-relaxed text-ink">
        Hi Amara, I came across your profile and your work as a Product Designer at Studio North caught my
        attention. I noticed you&apos;re open to networking — I&apos;d love to explore whether there&apos;s a
        project we could work on together.
      </div>
      <div className="mt-3 flex gap-2">
        <span className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">Copy message</span>
        <span className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-ink-2">Try another</span>
      </div>
    </div>
  );
}

/** Static illustration of the Contacts page (example people, not real). */
export function ContactsPreview() {
  const people = [
    { initials: "AO", name: "Amara Okafor", role: "Product Designer · Studio North", note: "Met at the fintech meetup" },
    { initials: "TB", name: "Tunde Bello", role: "ML Engineer · Brightwave", note: "Wants to talk about data teams" },
    { initials: "KE", name: "Kemi Eze", role: "Founder · Loop Health", note: null },
  ];
  return (
    <div className="w-full max-w-md rounded-[1.25rem] border border-border bg-surface p-5" role="img" aria-label="Example contacts list">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Contacts</p>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">Export all</span>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {people.map((p) => (
          <li key={p.name} className="flex items-start gap-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{p.initials}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">{p.name}</span>
              <span className="block truncate text-sm text-ink-2">{p.role}</span>
              {p.note && <span className="mt-1 block text-xs text-ink-3">{p.note}</span>}
            </span>
            <span className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-ink-2">Save to phone</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static illustration of a Spark introduction. */
export function SparkPreview() {
  return (
    <div className="w-full max-w-md rounded-[1.25rem] border border-border bg-surface p-5" role="img" aria-label="Example Spark introduction">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">Spark · today&apos;s introduction</p>
      <div className="mt-4 flex items-center gap-3.5">
        <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent">IA</span>
        <span>
          <span className="block text-lg font-semibold leading-tight text-ink">Ifeoma Adeyemi</span>
          <span className="block text-sm text-ink-2">Senior Product Designer · 8 years</span>
        </span>
      </div>
      <p className="mt-4 rounded-xl bg-bg px-3.5 py-3 text-[15px] leading-relaxed text-ink">
        You&apos;re both in product design, and Ifeoma has led the kind of design team you want to join.
      </p>
      <div className="mt-4 flex gap-2">
        <span className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">View card</span>
        <span className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-ink-2">1 free a month</span>
      </div>
    </div>
  );
}

/** Paying to message a mentor, shown as a short loop (card, Paystack checkout, conversation). */
export function MentorPreview() {
  return <MentorFlow />;
}

/** Static illustration of a member's card analytics. */
export function AnalyticsPreview() {
  const stats = [
    { label: "Profile views", value: "202" },
    { label: "QR scans", value: "91" },
    { label: "Saved you", value: "34" },
  ];
  // Views per day for a fortnight, as bar heights (percent).
  const bars = [30, 45, 38, 60, 52, 70, 48, 85, 66, 58, 92, 74, 80, 100];
  return (
    <div className="w-full max-w-md rounded-[1.25rem] border border-border bg-surface p-5" role="img" aria-label="Example card analytics">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Last 30 days</p>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">▲ 24% views</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <span key={s.label} className="rounded-xl bg-bg px-3 py-2.5">
            <span className="block text-xs text-ink-2">{s.label}</span>
            <span className="mt-0.5 block text-xl font-semibold tabular-nums text-ink">{s.value}</span>
          </span>
        ))}
      </div>
      <div className="mt-5 flex h-24 items-end gap-1.5" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-t bg-accent/80" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">Views per day · anonymous totals only</p>
    </div>
  );
}

/** Static illustration of an event page with its speakers. */
export function EventPreview() {
  const speakers = [
    { initials: "AO", name: "Amara Okafor", role: "Product Designer · Studio North", mentor: true },
    { initials: "TB", name: "Tunde Bello", role: "ML Engineer · Brightwave", mentor: false },
  ];
  return (
    <div className="w-full max-w-md rounded-[1.25rem] border border-border bg-surface p-5" role="img" aria-label="Example event page with speakers">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">Event · 5 Dec · Lagos</p>
      <p className="mt-1.5 text-lg font-semibold leading-tight text-ink">Design Day 2026</p>
      <p className="text-sm text-ink-2">Speakers</p>
      <ul className="mt-3 divide-y divide-border">
        {speakers.map((s) => (
          <li key={s.name} className="flex items-center gap-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{s.initials}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                {s.name}
                {s.mentor && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Mentor</span>}
              </span>
              <span className="block truncate text-sm text-ink-2">{s.role}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-ink-2">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4" />
              </svg>
              Badge QR
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
