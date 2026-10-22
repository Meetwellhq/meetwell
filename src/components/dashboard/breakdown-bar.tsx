import { ArrowDownRight, ArrowUpRight } from "lucide-react";
export type Slice = { label: string; value: number; color: string };

/**
 * Part-to-whole as one segmented bar: a headline share for the biggest part,
 * a thin bar of rounded segments with a small gap, and a legend
 * with each part's share underneath (so colour is never the only cue).
 */
export function BreakdownBar({
  title,
  slices,
  unit,
  change,
  empty,
}: {
  title: string;
  slices: Slice[];
  /** What's being counted, e.g. "views". */
  unit: string;
  /** Change in the total vs the period before, or null. */
  change: number | null;
  empty: string;
}) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const lead = slices.reduce((a, b) => (b.value > a.value ? b : a), slices[0]);
  const shown = slices.filter((s) => s.value > 0);

  return (
    <figure className="rounded-xl border border-border bg-surface p-5">
      <figcaption className="font-medium text-ink">{title}</figcaption>
      {total === 0 ? (
        <p className="mt-4 text-sm text-ink-3">{empty}</p>
      ) : (
        <>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-ink">{pct(lead.value)}%</span>
                <span className="text-sm text-ink-2">{lead.label}</span>
              </p>
              <p className="mt-1 text-sm text-ink-3">
                {total} {unit} in total
              </p>
            </div>
            {change !== null && change !== 0 && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-medium ${
                    change > 0 ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger"
                  }`}
                >
                  {change > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
                  {Math.abs(change)}%
                </span>
                last month
              </span>
            )}
          </div>

          <div className="mt-5 flex h-2.5 gap-1" aria-hidden>
            {shown.map((s) => (
              <div
                key={s.label}
                title={`${s.label}: ${s.value}`}
                className="h-full min-w-2 rounded-full"
                style={{
                  flexGrow: s.value,
                  flexBasis: 0,
                  backgroundColor: s.color,
                }}
              />
            ))}
          </div>

          <ul className="mt-5 flex flex-col gap-3 text-sm">
            {slices.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
                <span className="text-ink">{s.label}</span>
                <span className="ml-auto tabular-nums text-ink-3">{s.value}</span>
                <span className="w-11 text-right font-medium tabular-nums text-ink">{pct(s.value)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {slices.map((s) => (
            <tr key={s.label}>
              <th scope="row">{s.label}</th>
              <td>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
