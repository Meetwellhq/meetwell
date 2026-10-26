"use client";

import { Sparkles } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { adminSetSparkEnabled } from "@/lib/admin/actions";

export type SparkProgress = { users: number; mentors: number; mentees: number; enabled: boolean };

/** "About as many mentors as mentees": within 10% of each other. */
const balanced = (a: number, b: number) => a > 0 && b > 0 && Math.min(a, b) / Math.max(a, b) >= 0.9;

/**
 * Spark launch card on the admin Overview: Spark is paused until Meetwell has
 * `goal` users with about as many mentors (4+ years) as mentees, then Rasheed
 * launches it here. While paused it's hidden from members, marketing and emails.
 */
export function SparkLaunch({ progress, goal }: { progress: SparkProgress; goal: number }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const { users, mentors, mentees, enabled } = progress;
  const usersDone = users >= goal;
  const ratioDone = balanced(mentors, mentees);
  const ready = usersDone && ratioDone;
  const share = (n: number) => (mentors + mentees > 0 ? Math.round((n / (mentors + mentees)) * 100) : 0);

  const flip = (on: boolean) => {
    const question = on
      ? ready
        ? "Launch Spark for everyone now?"
        : "Meetwell hasn't reached the launch goal yet. Launch Spark anyway?"
      : "Pause Spark? It will be hidden from members, the website and emails again.";
    if (!confirm(question)) return;
    start(async () => {
      const { error } = await adminSetSparkEnabled(on);
      if (error) toast(error, "error");
      else toast(on ? "Spark is live." : "Spark is paused.");
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-ink">Spark launch</h2>
              {enabled ? <Badge tone="success">Live</Badge> : <Badge tone="warning">Paused</Badge>}
            </div>
            <p className="text-sm text-ink-2">
              {enabled
                ? "Spark is on for everyone."
                : `Hidden from members, the website and emails until Meetwell has ${goal.toLocaleString("en-GB")} users with about as many mentors as mentees.`}
            </p>
          </div>
        </div>
        {enabled ? (
          <Button variant="secondary" size="sm" loading={pending} onClick={() => flip(false)}>
            Pause Spark
          </Button>
        ) : (
          <Button size="sm" variant={ready ? "primary" : "secondary"} loading={pending} onClick={() => flip(true)}>
            Launch Spark
          </Button>
        )}
      </div>

      {!enabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">Users</span>
              <span className="tabular-nums text-ink">
                <strong className="font-semibold">{users.toLocaleString("en-GB")}</strong> of {goal.toLocaleString("en-GB")}
                {usersDone && " ✓"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={users} aria-valuemin={0} aria-valuemax={goal} aria-label="Users towards the launch goal">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (users / goal) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">Mentors to mentees (goal 1:1)</span>
              <span className="tabular-nums text-ink">
                <strong className="font-semibold">{mentors}</strong> : <strong className="font-semibold">{mentees}</strong>
                {ratioDone && " ✓"}
              </span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`${share(mentors)}% mentors, ${share(mentees)}% mentees`}>
              <div className="h-full bg-accent" style={{ width: `${share(mentors)}%` }} />
              <div className="h-full bg-accent/40" style={{ width: `${share(mentees)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-ink-3">
              {share(mentors)}% mentors (4+ years) · {share(mentees)}% mentees. Balanced means within 10% of each other.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
