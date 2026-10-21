import { SPARK_FREE_PER_MONTH, sparkResetDate } from "@/lib/matching/constants";

/** Free Spark introductions left this month, with a small progress row. */
export function SparkAllowance({ used }: { used: number }) {
  const usedThisMonth = Math.min(Math.max(used, 0), SPARK_FREE_PER_MONTH);
  const left = SPARK_FREE_PER_MONTH - usedThisMonth;
  const reset = sparkResetDate();

  return (
    <section className="rounded-xl bg-accent-soft p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-ink">
          {left} of {SPARK_FREE_PER_MONTH} free introductions left this month
        </p>
        <p className="text-sm text-ink-2">Resets {reset}</p>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: SPARK_FREE_PER_MONTH }, (_, i) => (
          <span key={i} className={i < usedThisMonth ? "h-2 flex-1 rounded-full bg-accent" : "h-2 flex-1 rounded-full bg-white"} />
        ))}
      </div>
      {left === 0 && (
        <p className="mt-3 text-sm text-ink-2">That&apos;s all for this month. More from {reset}.</p>
      )}
    </section>
  );
}
