import { LogoMark } from "./logo";

/**
 * Hero photo: two people looking at a phone, with a floating Meetwell QR card
 * beside the phone. Positions are percentages of the photo (1800×1200), so the
 * card stays next to the phone at any size.
 */
const PHOTO = "/hero/hero-photo.webp";

export function HeroPhoto({ qrSvg }: { qrSvg: string }) {
  return (
    <div
      role="img"
      aria-label="Two people smiling at a phone, with a Meetwell QR card beside it ready to scan"
      className="relative aspect-[3/2] w-full overflow-hidden rounded-[1.25rem] bg-[#e9d9c6]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO} alt="" width={1800} height={1200} className="absolute inset-0 h-full w-full object-cover" />

      {/* Floating QR card, just left of the phone */}
      <div className="absolute left-[12%] top-[44%] w-[16%] min-w-[110px] -rotate-3 rounded-xl bg-white p-2 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)] sm:p-2.5 lg:rounded-2xl lg:p-3">
        <div className="flex items-center gap-1.5">
          <LogoMark className="size-4 shrink-0 lg:size-5" />
          <span className="truncate text-[10px] font-semibold text-ink lg:text-xs">Meetwell</span>
        </div>
        <div
          className="mt-1.5 rounded-md border border-border p-1 lg:mt-2 [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-1.5 text-center text-[9px] font-medium leading-tight text-ink-2 lg:mt-2 lg:text-[11px]">
          Scan to connect
        </p>
      </div>
    </div>
  );
}
