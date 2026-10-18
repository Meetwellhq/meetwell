"use client";

import { useEffect, useRef, useState } from "react";
import { ScannerScreen } from "./hero-phones";

/**
 * Hero photo: a networking event where one attendee scans another's Meetwell
 * QR code; the phone in front shows the Meetwell scan screen.
 * The photo is AI-generated (Figma AI) — not a real person.
 *
 * Layers, on a fixed 1376×768 "stage" (the photo's pixel size) scaled to the
 * box width:
 *  1. the photo (the phone screen in it is blank white);
 *  2. the scan screen, warped onto the phone's screen;
 *  3. a cut-out of everything in the phone area that isn't screen (bezel,
 *     fingertips), so the screen takes the phone's exact shape.
 */
const STAGE_W = 1376;
const STAGE_H = 768;
const PHOTO = "/hero/hero-photo.webp";
const FRONT = "/hero/hero-photo-front.webp"; // 215×365, placed at (690, 225)

// Maps a 186×410 screen onto the phone's screen (slightly oversized; the front
// layer trims it to the real edge).
const SCREEN_TRANSFORM =
  "matrix3d(0.742072,-0.073558,0,-0.000086,-0.109423,0.708414,0,-0.000161,0,0,1,0,721,240,0,1)";

export function HeroPhoto({ qrSvg }: { qrSvg: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  // Scale the stage to the box width (CSS can't divide lengths reliably yet).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / STAGE_W);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={box}
      role="img"
      aria-label="At a networking event, a man scans a woman's Meetwell QR code and his phone offers to save her contact"
      className="relative aspect-[1376/768] w-full overflow-hidden rounded-[1.25rem] bg-[#e9d9c6]"
    >
      <div
        className="absolute left-0 top-0 origin-top-left transition-opacity duration-300"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale ?? 0})`, opacity: scale ? 1 : 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO} alt="" width={STAGE_W} height={STAGE_H} className="absolute inset-0 h-full w-full" />

        <div className="absolute left-0 top-0 h-[410px] w-[186px] origin-top-left overflow-hidden" style={{ transform: SCREEN_TRANSFORM }}>
          <ScannerScreen qrSvg={qrSvg} />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FRONT} alt="" width={215} height={365} className="absolute left-[690px] top-[225px] h-[365px] w-[215px]" />
      </div>
    </div>
  );
}
