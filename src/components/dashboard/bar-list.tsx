/**
 * A list of thin horizontal bars: each row names a thing, shows its number in
 * the brand green, and fills a soft track in proportion to the biggest row.
 * One colour throughout, so the label carries identity, not the colour.
 */
export function BarList({ title, rows, empty }: { title: string; rows: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);

  return (
    <figure className="rounded-xl border border-border bg-surface p-5">
      <figcaption className="font-medium text-ink">{title}</figcaption>
      {max === 0 ? (
        <p className="mt-4 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3.5">
          {rows.map((r) => (
            <li key={r.label}>
              <p className="flex items-baseline gap-2 text-sm">
                <span className="font-medium text-ink">{r.label}</span>
                <span className="font-medium tabular-nums text-accent">{r.value}</span>
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent-soft" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: r.value === 0 ? 0 : `max(${(r.value / max) * 100}%, 6px)` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
