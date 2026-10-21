/**
 * A small single-series bar chart for the admin overview: brand green bars with
 * 4px rounded tops on a baseline, a recessive grid, labels under the bars and a
 * tooltip on hover (the whole column is the hit target). A hidden table carries
 * the same numbers for screen readers. One series, so the title names it and
 * there's no legend.
 */
export function BarChart({
  title,
  points,
  format,
  labelEvery = 1,
}: {
  title: string;
  points: { label: string; value: number }[];
  format: (n: number) => string;
  /** Show every nth x-axis label (keeps 12 weeks readable). */
  labelEvery?: number;
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  const top = max === 0 ? 1 : max;
  const last = points.at(-1);

  return (
    <figure className="rounded-xl border border-border bg-surface p-5">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="font-medium text-ink">{title}</span>
        {last && <span className="text-sm text-ink-2">Latest: {format(last.value)}</span>}
      </figcaption>

      <div className="relative mt-5 h-40" aria-hidden>
        {/* Recessive grid: top and middle lines, plus the baseline. */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-x-0 bottom-0 border-t border-border-strong" />
        <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[11px] tabular-nums text-ink-3">{format(top)}</span>

        <div className="absolute inset-0 flex items-end gap-0.5">
          {points.map((p) => (
            <div key={p.label} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-10 rounded-t bg-accent transition-opacity group-hover:opacity-80"
                style={{ height: p.value === 0 ? 0 : `max(${(p.value / top) * 100}%, 3px)` }}
              />
              <div
                className="pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink shadow-sm group-hover:block"
                style={{ bottom: `calc(${(p.value / top) * 100}% + 6px)` }}
              >
                <span className="text-ink-2">{p.label}</span> · <span className="font-medium tabular-nums">{format(p.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-0.5 text-[11px] text-ink-3" aria-hidden>
        {points.map((p, i) => (
          <span key={p.label} className="flex-1 truncate text-center">
            {i % labelEvery === (points.length - 1) % labelEvery ? p.label : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
