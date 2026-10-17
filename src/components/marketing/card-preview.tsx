import { Globe, Mail, Phone, UserRoundPlus } from "lucide-react";
import { SocialIcon } from "@/components/icons/social-icon";

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
        <div className="mt-5 flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-medium text-accent-ink">
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
    <div className="rounded-[1.75rem] border border-border bg-surface p-5" role="img" aria-label="Example conversation starter">
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
        <span className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">Copy message</span>
        <span className="inline-flex h-9 items-center rounded-full px-3 text-sm text-ink-2">Try another</span>
      </div>
    </div>
  );
}
