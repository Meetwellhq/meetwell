import { Check, Circle } from "lucide-react";
import Link from "next/link";
import type { CompletenessItem } from "@/lib/matching/completeness";
import { Card } from "@/components/ui/misc";

/**
 * The profile score and what's still missing, on the Edit card page. Items
 * filled in on this page are plain; the Spark-only ones (when Spark is on)
 * link to the Spark page.
 */
export function ProfileStrength({ percent, items }: { percent: number; items: CompletenessItem[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Profile strength</h2>
        <span className="text-sm font-medium tabular-nums text-ink-2">{percent}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            {c.done ? <Check className="size-4 text-success" aria-hidden /> : <Circle className="size-4 text-ink-3" aria-hidden />}
            {c.done || c.where === "card" ? (
              <span className={c.done ? "text-ink-2" : "text-ink"}>{c.label}</span>
            ) : (
              <Link href="/dashboard/matches" className="text-ink hover:underline">
                {c.label}
              </Link>
            )}
            <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
          </li>
        ))}
      </ul>
      {percent < 100 && (
        <p className="mt-4 text-sm text-ink-3">Fill in what&apos;s missing below, then save. Mentors need at least 80%.</p>
      )}
    </Card>
  );
}
