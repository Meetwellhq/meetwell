"use client";

import { ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * One text box with a list of suggestions: click to pick from the list, or
 * just type your own. Typing filters the list. Whatever is in the box is saved.
 */
export function PickOrType({
  id,
  describedBy,
  invalid,
  value,
  onChange,
  groups,
  maxLength,
  placeholder,
  autoComplete,
}: {
  id: string;
  describedBy?: string;
  invalid: boolean;
  value: string;
  onChange: (value: string) => void;
  groups: { label: string; options: readonly string[] }[];
  maxLength: number;
  placeholder: string;
  autoComplete?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Show the whole list until the person starts typing in this visit.
  const [query, setQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = (query ?? "").trim().toLowerCase();
  const filtered = groups
    .map((g) => ({ ...g, options: g.options.filter((o) => !q || o.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0);
  const flat = filtered.flatMap((g) => g.options);

  const choose = (option: string) => {
    onChange(option);
    setQuery(null);
    setOpen(false);
    setActive(-1);
  };

  const close = () => {
    setOpen(false);
    setActive(-1);
    setQuery(null);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        invalid={invalid}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={close}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, flat.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && active >= 0) {
            e.preventDefault();
            choose(flat[active]);
          } else if (e.key === "Escape") {
            close();
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show suggestions"
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-3"
        onMouseDown={(e) => {
          e.preventDefault(); // keep focus in the box
          if (open) close();
          else {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>

      {open && flat.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.map((g) => (
            <li key={g.label} role="presentation">
              <p className="px-3.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-3">{g.label}</p>
              <ul role="presentation">
                {g.options.map((o) => {
                  const i = flat.indexOf(o);
                  return (
                    <li
                      key={o}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={o === value}
                      className={cn(
                        "cursor-pointer px-3.5 py-2 text-[15px] text-ink",
                        i === active ? "bg-surface-2" : "hover:bg-surface-2",
                        o === value && "font-medium text-accent",
                      )}
                      // mousedown, so the pick lands before the box loses focus
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(o);
                      }}
                    >
                      {o}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          <li role="presentation" className="border-t border-border px-3.5 py-2 text-xs text-ink-3">
            Not listed? Just type your own.
          </li>
        </ul>
      )}
    </div>
  );
}
