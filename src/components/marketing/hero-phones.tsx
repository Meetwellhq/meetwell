import { Phone, UserRoundPlus } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "./logo";

/**
 * Hero illustration: the owner's phone shows their Meetwell card, and a
 * visitor's phone has scanned the QR code and offers "Save contact".
 * Example person — not a real user.
 */
export function HeroPhones({ qrSvg }: { qrSvg: string }) {
  return (
    // Drawn at one size (26×32rem) and scaled as a whole, so the phone screens
    // look the same on every screen size. The outer box reserves the scaled size.
    <div
      role="img"
      aria-label="A phone showing a Meetwell card with a QR code, and a second phone that has scanned it and offers to save the contact"
      className="relative mx-auto h-[20.8rem] w-[16.9rem] sm:h-[32rem] sm:w-[26rem]"
    >
      <div className="absolute left-0 top-0 h-[32rem] w-[26rem] origin-top-left scale-[0.65] sm:scale-100">
        {/* Owner's phone */}
        <PhoneFrame className="absolute left-0 top-0 w-[12.5rem]" rotate={-6}>
          <OwnerScreen qrSvg={qrSvg} />
        </PhoneFrame>

        {/* Visitor's phone, after scanning */}
        <PhoneFrame className="absolute bottom-0 right-0 w-[12.5rem]" rotate={6}>
          <ScannerScreen qrSvg={qrSvg} />
        </PhoneFrame>
      </div>
    </div>
  );
}

function PhoneFrame({ children, className, rotate }: { children: ReactNode; className?: string; rotate: number }) {
  return (
    <div className={className} style={{ transform: `rotate(${rotate}deg)` }}>
      <div className="rounded-[2rem] bg-[#141413] p-[7px] shadow-[0_24px_48px_-16px_rgb(0_0_0/0.45)]">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[1.6rem] bg-surface">
          <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-[#141413]" />
          {children}
        </div>
      </div>
    </div>
  );
}

/** The owner's Meetwell card with a large QR code. */
function OwnerScreen({ qrSvg }: { qrSvg: string }) {
  return (
    <div className="flex h-full flex-col items-center px-3.5 pb-4 pt-9 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">AO</div>
      <p className="mt-2 text-[13px] font-semibold leading-tight text-ink">Amara Okafor</p>
      <p className="text-[10px] text-ink-2">Product Designer · Studio North</p>
      <div className="mt-3 w-full rounded-xl border border-border p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <p className="mt-2 text-[9px] font-medium uppercase tracking-wider text-ink-3">Scan to connect</p>
      <div className="mt-auto flex items-center gap-1 text-[9px] text-ink-3">
        <LogoMark className="size-3" /> meetwell.me
      </div>
    </div>
  );
}

/** The visitor's camera locked on the QR code, offering to save the contact. */
export function ScannerScreen({ qrSvg }: { qrSvg: string }) {
  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-[#3a3a37] via-[#2a2a28] to-[#1e1e1d] px-3 pb-3 pt-8">
      {/* QR link banner, like the camera app shows */}
      <div className="flex items-center gap-2 rounded-xl bg-surface/95 px-2.5 py-2 shadow-lg">
        <LogoMark className="size-5 shrink-0" />
        <div className="min-w-0 text-left">
          <p className="text-[9px] font-semibold leading-tight text-ink">meetwell.me</p>
          <p className="truncate text-[9px] leading-tight text-ink-2">Open Amara Okafor&apos;s card</p>
        </div>
      </div>

      {/* viewfinder */}
      <div className="relative mx-auto mt-5 w-[62%]">
        <span className="absolute -left-2 -top-2 size-5 rounded-tl-lg border-l-[3px] border-t-[3px] border-[#ffd60a]" />
        <span className="absolute -right-2 -top-2 size-5 rounded-tr-lg border-r-[3px] border-t-[3px] border-[#ffd60a]" />
        <span className="absolute -bottom-2 -left-2 size-5 rounded-bl-lg border-b-[3px] border-l-[3px] border-[#ffd60a]" />
        <span className="absolute -bottom-2 -right-2 size-5 rounded-br-lg border-b-[3px] border-r-[3px] border-[#ffd60a]" />
        <div className="rounded-md bg-surface p-1.5 opacity-90 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>

      {/* save sheet */}
      <div className="mt-auto rounded-2xl bg-surface p-2.5 text-left shadow-xl">
        <div className="flex items-center gap-2">
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">AO</div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-tight text-ink">Amara Okafor</p>
            <p className="flex items-center gap-0.5 whitespace-nowrap text-[8.5px] text-ink-2">
              <Phone className="size-2.5" aria-hidden /> +234 803 123 4567
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-accent text-[11px] font-medium text-white">
          <UserRoundPlus className="size-3.5" aria-hidden /> Save contact
        </div>
      </div>
    </div>
  );
}
