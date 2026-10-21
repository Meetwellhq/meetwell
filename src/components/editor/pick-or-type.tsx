"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";

const OTHER = "__other__";

/**
 * A dropdown of suggestions with "Other" at the end. Picking Other (or having
 * a saved value that isn't in the list) shows a text box to type your own.
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
  otherLabel,
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
  otherLabel: string;
  autoComplete?: string;
}) {
  const inList = groups.some((g) => g.options.includes(value));
  const [typing, setTyping] = useState(!!value && !inList);
  const selected = typing ? OTHER : inList ? value : "";

  const options = (list: readonly string[]) =>
    list.map((o) => (
      <option key={o} value={o}>
        {o}
      </option>
    ));

  return (
    <div className="flex flex-col gap-2">
      <Select
        id={id}
        aria-describedby={describedBy}
        invalid={invalid && !typing}
        value={selected}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER) {
            setTyping(true);
            if (inList) onChange("");
          } else {
            setTyping(false);
            onChange(next);
          }
        }}
      >
        <option value="">Choose…</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {options(g.options)}
          </optgroup>
        ))}
        <option value={OTHER}>{otherLabel}</option>
      </Select>
      {typing && (
        <Input
          aria-label={otherLabel}
          aria-describedby={describedBy}
          invalid={invalid}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={!value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
