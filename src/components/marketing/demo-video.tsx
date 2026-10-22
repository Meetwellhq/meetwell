"use client";

import { useEffect, useRef } from "react";

/**
 * The demo video in a phone-shaped frame. It plays muted (subtitles are in the
 * picture) while it's on screen and pauses when scrolled away. Visitors can
 * unmute or replay with the controls. No autoplay for reduced-motion users.
 */
export function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.5 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full max-w-[19rem] rounded-[2.5rem] bg-ink p-2.5 shadow-[0_30px_60px_-25px_rgb(20_20_19/0.45)]">
      <video
        ref={ref}
        className="aspect-[9/16] w-full rounded-[2rem] bg-ink object-cover"
        src="/demo/meetwell-demo.mp4"
        poster="/demo/meetwell-demo-poster.jpg"
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label="Meetwell demo video: scanning a card, saving a contact, Icebreaker, Contacts, Spark and paid mentoring"
      />
    </div>
  );
}
