"use client";

import { Check, ChevronDown, MoveRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CompletenessItem, CompletenessKey } from "@/lib/matching/completeness";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, Card } from "@/components/ui/misc";

/** A short tip for each item, and the Profile page section (or Spark page) where it's filled in. */
const GUIDE: Record<CompletenessKey, { tip: string; section?: string }> = {
  photo: { tip: "A clear photo of you. People save and reply far more when they can see who they met.", section: "edit-about" },
  title: { tip: "What you do, in a few words, so people can place you.", section: "edit-about" },
  organisation: { tip: "Where you work or study.", section: "edit-about" },
  bio: { tip: "A line or two about your work and what you'd like to talk about.", section: "edit-about" },
  contact: { tip: "An email, WhatsApp or phone number that's set to public, so people can reach you.", section: "edit-contact" },
  social: { tip: "Instagram, TikTok, YouTube, LinkedIn or X. Somewhere people can see more of you.", section: "edit-social" },
  link: { tip: "A website or social link people can open from your card.", section: "edit-social" },
  field: { tip: "The area you work in.", section: "edit-experience" },
  years: { tip: "How long you've worked. With 4 or more years you can apply to mentor.", section: "edit-experience" },
  lookingFor: { tip: "Tell Spark who you'd like to meet." },
  city: { tip: "Where you're based, for introductions near you." },
};

/** Profile strength on the Profile page: the score, and a checklist of what's done and what's left. */
export function ProfileStrength({ percent, items }: { percent: number; items: CompletenessItem[] }) {
  const [open, setOpen] = useState(false);
  const done = items.filter((i) => i.done).length;
  const [expanded, setExpanded] = useState<CompletenessKey | null>(items.find((i) => !i.done)?.key ?? null);

  const goTo = (section: string) => {
    setOpen(false);
    const el = document.getElementById(section);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    // After the dialog has closed and handed focus back, put it in the section's first field.
    requestAnimationFrame(() => el?.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true }));
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Profile strength</h2>
        <span className="text-sm font-medium tabular-nums text-ink-2">{percent}%</span>
      </div>
      <Bar percent={percent} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {done === items.length ? "Everything's done. Nice work." : `${done} of ${items.length} done. Mentors need at least 80%.`}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {done === items.length ? "View checklist" : "Complete profile"}
          <MoveRight className="size-4" aria-hidden />
        </button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Your profile checklist" badge={<Badge tone="success" className="tabular-nums">{done}/{items.length}</Badge>}>
        <Bar percent={percent} className="-mt-2" />
        <ul className="mt-4 divide-y divide-border">
          {items.map((item) => {
            const guide = GUIDE[item.key];
            if (item.done) {
              return (
                <li key={item.key} className="flex items-center gap-3 py-3.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden>
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="text-[15px] text-ink-3 line-through">{item.label}</span>
                  <span className="sr-only">(done)</span>
                </li>
              );
            }
            const isOpen = expanded === item.key;
            return (
              <li key={item.key} className="py-3.5">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="size-6 shrink-0 rounded-full border-2 border-border-strong" aria-hidden />
                  <span className="flex-1 text-[15px] font-medium">{item.label}</span>
                  <span className="sr-only">(to do)</span>
                  <ChevronDown className={cn("size-4 text-ink-3 transition-transform", isOpen && "rotate-180")} aria-hidden />
                </button>
                {isOpen && (
                  <div className="mt-2 pl-9">
                    <p className="text-sm text-ink-2">{guide.tip}</p>
                    {guide.section ? (
                      <Button size="sm" className="mt-3" onClick={() => goTo(guide.section!)}>
                        Add it
                      </Button>
                    ) : (
                      <Link href="/dashboard/matches" className={buttonClass({ size: "sm", className: "mt-3" })}>
                        Add it on Spark
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Dialog>
    </Card>
  );
}

function Bar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div
      className={cn("mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Profile completion"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}
