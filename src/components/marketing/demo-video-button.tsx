"use client";

import { Play, X } from "lucide-react";
import { useRef } from "react";
import { buttonClass } from "@/components/ui/button";

/**
 * "See how it works": opens the demo video in a pop-up and plays it with sound
 * (the click lets the browser play audio). A native <dialog> handles Esc,
 * focus and the backdrop; clicking outside the video also closes it.
 */
export function DemoVideoButton({ className }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  // iPhone Safari is strict: play() must start in the tap itself (before
  // anything async), and rewinding a video that hasn't loaded yet can throw
  // and stop it. If sound is still blocked, play muted rather than not at all.
  const open = () => {
    const v = video.current;
    if (v) {
      if (v.readyState > 0) v.currentTime = 0;
      v.muted = false;
      v.play().catch(() => {
        v.muted = true;
        void v.play().catch(() => {});
      });
    }
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" onClick={open} className={buttonClass({ variant: "secondary", size: "lg", className })}>
        <Play className="size-4 fill-current" aria-hidden />
        See how it works
      </button>
      <dialog
        ref={dialog}
        aria-label="Meetwell demo video"
        onClose={() => video.current?.pause()}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto max-h-none max-w-none bg-transparent p-4 backdrop:bg-ink/80 backdrop:backdrop-blur-sm"
      >
        <div className="relative">
          <video
            ref={video}
            src="/demo/meetwell-demo.mp4"
            poster="/demo/meetwell-demo-poster.jpg"
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] h-[min(85dvh,52rem)] w-auto max-w-[calc(100vw-2rem)] rounded-3xl bg-[#141413] object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close video"
            className="absolute -right-2 -top-2 grid size-10 place-items-center rounded-full bg-surface text-ink shadow-lg hover:bg-surface-2 sm:-right-4 sm:-top-4"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </dialog>
    </>
  );
}
