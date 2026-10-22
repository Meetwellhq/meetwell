"use client";

import { cn } from "@/lib/cn";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Visible text beside the switch; defaults to Public/Private. */
  showState?: boolean;
  disabled?: boolean;
};

/** Accessible public/private toggle. */
export function Switch({ checked, onChange, label, showState = true, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex shrink-0 items-center gap-2 rounded-full text-sm disabled:opacity-50"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
          checked ? "bg-accent" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-surface shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      {showState && (
        <span className={cn("w-12 text-left font-medium", checked ? "text-accent" : "text-ink-3")}>
          {checked ? "Public" : "Private"}
        </span>
      )}
    </button>
  );
}
