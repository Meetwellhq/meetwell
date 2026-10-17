import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-surface", className)} {...props} />;
}

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-[#fffaeb] text-[#93370d]",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">{icon}</div>}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-[15px] text-ink-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "danger" | "success";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    neutral: "border-border bg-surface-2 text-ink-2",
    danger: "border-[#fecdca] bg-danger-soft text-danger",
    success: "border-[#abefc6] bg-success-soft text-success",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", styles, className)}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} aria-hidden />;
}
