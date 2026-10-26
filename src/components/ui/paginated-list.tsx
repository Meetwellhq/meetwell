"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * "Showing 1 to 10 of 24" and the page buttons (the same look as the admin
 * Users page). Hidden when everything fits on one page.
 */
export function Pager({
  page,
  total,
  perPage = 10,
  setPage,
  scrollTop = true,
}: {
  page: number;
  total: number;
  perPage?: number;
  setPage: (n: number) => void;
  /** Scroll back to the top of the page after changing page. */
  scrollTop?: boolean;
}) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const go = (n: number) => {
    setPage(n);
    if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cls = "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm tabular-nums transition-colors";
  const idle = "border-border text-ink-2 hover:border-border-strong hover:text-ink disabled:pointer-events-none disabled:opacity-50";
  return (
    <nav className="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Pages">
      <p className="text-sm text-ink-2">
        Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={cn(cls, idle)} disabled={page === 1} onClick={() => go(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
          .map((n, i, list) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - list[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
              <button
                type="button"
                onClick={() => go(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={cn(cls, n === page ? "border-accent bg-accent-soft font-medium text-accent" : idle)}
              >
                {n}
              </button>
            </span>
          ))}
        <button type="button" className={cn(cls, idle)} disabled={page === pages} onClick={() => go(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/**
 * A <ul> that shows its rows 10 at a time with page buttons underneath, so long
 * admin lists stay short. Pass the <li> rows as children; `className` styles the <ul>.
 */
export function PaginatedList({ children, className, perPage = 10 }: { children: ReactNode; className?: string; perPage?: number }) {
  const rows = Children.toArray(children);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  // If rows disappear (e.g. after a delete), stay on a page that exists.
  const current = Math.min(page, pages);
  return (
    <div className="flex flex-col gap-3">
      <ul className={className}>{rows.slice((current - 1) * perPage, current * perPage)}</ul>
      <Pager page={current} total={rows.length} perPage={perPage} setPage={setPage} scrollTop={false} />
    </div>
  );
}
