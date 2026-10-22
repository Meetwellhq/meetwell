"use client";

import { useState } from "react";

type Point = { label: string; value: number };

/** A "nice" axis step so ticks land on round numbers (1, 2, 5, 10, 20...). */
function niceStep(max: number, ticks: number) {
  const raw = Math.max(max, 1) / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return Math.max(1, step);
}

/** A smooth path through the points that never overshoots (monotone cubic). */
function smoothPath(xy: [number, number][]) {
  if (xy.length < 2) return xy.length ? `M${xy[0][0]},${xy[0][1]}` : "";
  const n = xy.length;
  const d = xy.slice(1).map(([x, y], i) => (y - xy[i][1]) / (x - xy[i][0]));
  const m = xy.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  let path = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = xy[i];
    const [x1, y1] = xy[i + 1];
    const h = (x1 - x0) / 3;
    path += ` C${(x0 + h).toFixed(1)},${(y0 + m[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - m[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return path;
}

/**
 * A smooth line chart for one period, with an optional dashed line for the
 * period before. Recessive grid with round-number ticks on the right, a few
 * date labels, and a crosshair with a tooltip on hover (the whole plot is the
 * hit target). A legend names both lines; a hidden table carries the numbers.
 */
export function LineChart({
  title,
  points,
  compare,
  labels = ["Last 30 days", "30 days before"],
  labelEvery = 7,
}: {
  title: string;
  points: Point[];
  /** Same length as points: the period before, drawn dashed. */
  compare?: number[];
  labels?: [string, string];
  /** Show every nth x-axis label. */
  labelEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), ...(compare ?? []), 0);
  const step = niceStep(max, 3);
  const top = Math.max(step * Math.ceil(max / step), step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const total = points.reduce((n, p) => n + p.value, 0);
  const W = 600;
  const H = 160;
  const last = points.length - 1;
  const x = (i: number) => (last > 0 ? (i / last) * W : W / 2);
  const y = (v: number) => H - (v / top) * H;
  const line = smoothPath(points.map((p, i) => [x(i), y(p.value)]));
  const before = compare ? smoothPath(compare.map((v, i) => [x(i), y(v)])) : null;
  const active = hover === null ? null : points[hover];
  const pct = (px: number) => `${(px / W) * 100}%`;

  return (
    <figure className="rounded-xl border border-border bg-surface p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span className="font-medium text-ink">{title}</span>
        <span className="flex items-center gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-accent" aria-hidden />
            {labels[0]} · <span className="tabular-nums text-ink">{total}</span>
          </span>
          {compare && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-ink-3" aria-hidden />
              {labels[1]}
            </span>
          )}
        </span>
      </figcaption>

      <div className="mt-5 flex gap-3">
        <div
          className="relative h-40 flex-1"
          aria-hidden
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - box.left) / box.width) * last);
            setHover(Math.min(Math.max(i, 0), last));
          }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${t === 0 ? "border-border-strong" : "border-border"}`}
              style={{ top: `${(y(t) / H) * 100}%` }}
            />
          ))}

          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {before && (
              <path d={before} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" opacity="0.7" />
            )}
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>

          {active && hover !== null && (
            <>
              <div className="pointer-events-none absolute inset-y-0 border-l border-border-strong" style={{ left: pct(x(hover)) }} />
              <div
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
                style={{ left: pct(x(hover)), top: `${(y(active.value) / H) * 100}%` }}
              />
              <div
                className={`pointer-events-none absolute -top-1 z-10 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink shadow-sm ${hover > last / 2 ? "-ml-2 -translate-x-full" : "ml-2"}`}
                style={{ left: pct(x(hover)) }}
              >
                <span className="text-ink-2">{active.label}</span> · <span className="font-medium tabular-nums">{active.value}</span>
                {compare && <span className="text-ink-3"> (before: {compare[hover]})</span>}
              </div>
            </>
          )}
        </div>

        <div className="relative h-40 w-6 shrink-0 text-[11px] tabular-nums text-ink-3" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(y(t) / H) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mr-9 mt-2 h-4 text-[11px] text-ink-3" aria-hidden>
        {points.map((p, i) =>
          i % labelEvery === last % labelEvery ? (
            <span
              key={p.label}
              className={`absolute whitespace-nowrap ${i === last ? "-translate-x-full" : i === 0 ? "" : "-translate-x-1/2"}`}
              style={{ left: pct(x(i)) }}
            >
              {p.label}
            </span>
          ) : null,
        )}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{labels[0]}</th>
            {compare && <th scope="col">{labels[1]}</th>}
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{p.value}</td>
              {compare && <td>{compare[i]}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
