import { Check, Circle } from "lucide-react";
import Link from "next/link";

type StatusCheck = { label: string; done: boolean; where: "card" | "below" };

/** For members with 4+ years: are they on Spark's list, and how often were they introduced? */
export function MentorStatus({
  checks,
  introduced,
  fieldName,
}: {
  checks: StatusCheck[];
  introduced: { this_month: number; total: number };
  fieldName: string | null;
}) {
  const ready = checks.every((c) => c.done);
  const who = fieldName ? `people earlier in their careers in ${fieldName.toLowerCase()}` : "people earlier in their careers";

  return (
    <section className="rounded-xl bg-accent-soft p-5">
      <p className="font-medium text-ink">
        {ready ? "You're on Spark's list" : "A few steps and Spark can recommend you"}
      </p>
      <p className="mt-0.5 text-sm text-ink-2">
        {ready
          ? `Spark can introduce ${who} to you. They'll see your card and may reach out.`
          : `Once these are done, Spark can introduce ${who} to you.`}
      </p>

      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-ink">
              {c.done ? (
                <Check className="size-4 text-accent" aria-hidden />
              ) : (
                <Circle className="size-4 text-ink-3" aria-hidden />
              )}
              {c.label}
              <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
            </span>
            {!c.done &&
              (c.where === "card" ? (
                <Link href="/dashboard/profile" className="shrink-0 font-medium text-accent hover:underline">
                  Edit profile
                </Link>
              ) : (
                <span className="shrink-0 text-ink-3">Below</span>
              ))}
          </li>
        ))}
      </ul>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-sm text-ink-2">Introduced to you this month</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{introduced.this_month}</dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-sm text-ink-2">In total</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{introduced.total}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-3">
        Introductions go one way, so we don&apos;t share who. If someone reaches out, you&apos;ll hear from them directly.
      </p>
    </section>
  );
}
