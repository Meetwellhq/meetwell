"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { saveMatchingPrefs } from "@/lib/matching/actions";
import { FIELDS, LOOKING_FOR } from "@/lib/matching/constants";

export type MatchingPrefs = {
  optIn: boolean;
  field: string | null;
  experienceYears: number | null;
  lookingFor: string[];
  city: string | null;
};

/** The member's matching details. Private: used for matching only, never shown on the public card. */
export function MatchingPrefsForm({ initial }: { initial: MatchingPrefs }) {
  const [state, action, pending] = useActionState(saveMatchingPrefs, {});
  const [optIn, setOptIn] = useState(initial.optIn);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-ink">Find me matches</p>
          <p className="mt-0.5 text-sm text-ink-2">
            Get recommendations of people worth meeting, and appear in other members&apos; recommendations.
          </p>
        </div>
        <Switch checked={optIn} onChange={setOptIn} label="Find me matches" showState={false} />
        {optIn && <input type="hidden" name="optIn" value="on" />}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your field" error={err.field}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} name="field" defaultValue={initial.field ?? ""} aria-describedby={describedBy} invalid={invalid}>
              <option value="">Choose…</option>
              {FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Years of experience" error={err.experienceYears}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="experienceYears"
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              defaultValue={initial.experienceYears ?? ""}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">I&apos;m looking for</legend>
        {LOOKING_FOR.map((l) => (
          <label key={l.value} className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="lookingFor"
              value={l.value}
              defaultChecked={initial.lookingFor.includes(l.value)}
              className="size-4 accent-[var(--accent)]"
            />
            {l.label}
          </label>
        ))}
      </fieldset>

      <Field label="City" optional error={err.city} hint="Helps match you with people nearby.">
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="city" defaultValue={initial.city ?? ""} placeholder="e.g. Lagos" aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>

      <p className="text-xs text-ink-3">
        These details are private. They&apos;re only used to find matches, and aren&apos;t shown on your card.
      </p>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">Saved.</Alert>}
      <div>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
