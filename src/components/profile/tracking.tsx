"use client";

import { useEffect, type ComponentProps } from "react";
import { recordProfileEvent } from "@/lib/profiles/actions";
import type { EventType } from "@/lib/profiles/types";

/** Fire-and-forget anonymous event. No-op in preview mode (slug null). */
export function track(slug: string | null, type: EventType, source?: "qr" | "link") {
  if (!slug) return;
  void recordProfileEvent({ slug, type, source: source ?? null }).catch(() => {});
}

/** Counts one view per profile per browser session. */
export function ViewTracker({ slug, source }: { slug: string; source: "qr" | "link" }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable (private mode): still count the view.
    }
    track(slug, "view", source);
  }, [slug, source]);
  return null;
}

export function TrackedLink({
  slug,
  event,
  ...props
}: ComponentProps<"a"> & { slug: string | null; event: EventType }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        track(slug, event);
        props.onClick?.(e);
      }}
    />
  );
}
