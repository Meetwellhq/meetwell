"use client";

import { Field, Input, Select } from "@/components/ui/field";
import { FIELDS, isMentor } from "@/lib/matching/constants";

export type Experience = { field: string; experienceYears: string };

/** Field and years of experience. Private: never shown on the card. `spark` = whether Spark is switched on. */
export function ExperienceFields({
  value,
  onChange,
  errors = {},
  spark = true,
}: {
  value: Experience;
  onChange: (next: Experience) => void;
  errors?: Record<string, string>;
  spark?: boolean;
}) {
  const years = value.experienceYears.trim() === "" ? null : Number(value.experienceYears);
  const hint = spark
    ? isMentor(years)
      ? "You'll appear as a mentor on Spark, so people earlier in their careers can be introduced to you."
      : "Spark uses this to introduce you to people a step ahead who can help you grow in your career."
    : isMentor(years)
      ? "With 4 or more years, you can become a mentor on Meetwell and earn from what you know."
      : "This helps us set up Meetwell for where you are in your career.";
  return (
    <div className="flex flex-col gap-5">
      <Field label="Years of experience" error={errors.experienceYears} hint={hint}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={value.experienceYears}
            onChange={(e) => onChange({ ...value, experienceYears: e.target.value })}
            placeholder="e.g. 3"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <Field label="Your field" error={errors.field}>
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            value={value.field}
            onChange={(e) => onChange({ ...value, field: e.target.value })}
            aria-describedby={describedBy}
            invalid={invalid}
          >
            <option value="">Choose…</option>
            {FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <p className="text-sm text-ink-3">
        {spark
          ? "This stays private. It's only used by Spark, our introductions feature, and never shows on your card."
          : "This stays private and never shows on your card."}
      </p>
    </div>
  );
}
