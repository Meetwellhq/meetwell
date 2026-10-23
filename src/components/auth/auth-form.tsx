"use client";

import { useActionState, useState, type ReactNode } from "react";
import { AUTH_BUTTON } from "@/components/auth/auth-section";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { PasswordInput } from "@/components/ui/password-input";
import type { AuthFormState } from "@/lib/auth/actions";

type FieldDef = {
  name: string;
  label: string;
  type: "email" | "password" | "text" | "number";
  autoComplete: string;
  hint?: string;
};

type Props = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: FieldDef[];
  submitLabel: string;
  hidden?: Record<string, string>;
  /** Hide the form once a success message is shown (e.g. "check your email"). */
  hideOnMessage?: boolean;
  footer?: ReactNode;
  /** Sign-up: a required "I'm at least 18" tick box (also checked on the server). */
  confirmAge?: boolean;
};

export function AuthForm({ action, fields, submitLabel, hidden, hideOnMessage, footer, confirmAge }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [adultTicked, setAdultTicked] = useState(false);

  if (hideOnMessage && state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f) => (
        <Field key={f.name} label={f.label} hint={f.hint} error={state.fieldErrors?.[f.name]}>
          {({ id, describedBy, invalid }) =>
            f.type === "password" ? (
              <PasswordInput
                id={id}
                name={f.name}
                autoComplete={f.autoComplete}
                aria-describedby={describedBy}
                invalid={invalid}
                required
              />
            ) : (
            <Input
              id={id}
              name={f.name}
              type={f.type}
              inputMode={f.type === "number" ? "numeric" : undefined}
              min={f.type === "number" ? 0 : undefined}
              max={f.type === "number" ? 60 : undefined}
              autoComplete={f.autoComplete}
              defaultValue={f.type === "email" ? state.email : state.values?.[f.name]}
              aria-describedby={describedBy}
              invalid={invalid}
              required
            />
          )}
        </Field>
      ))}
      {confirmAge && (
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-ink-2">
            <input
              type="checkbox"
              name="adult"
              value="yes"
              required
              // React resets the form after each try; this keeps the tick when the form comes back with an error.
              defaultChecked={adultTicked}
              onChange={(e) => setAdultTicked(e.target.checked)}
              aria-invalid={state.fieldErrors?.adult ? true : undefined}
              aria-describedby={state.fieldErrors?.adult ? "adult-error" : undefined}
              className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-accent"
            />
            <span>By ticking this box, you confirm you are at least 18 years old.</span>
          </label>
          {state.fieldErrors?.adult && (
            <p id="adult-error" className="mt-1.5 pl-8 text-sm text-danger">
              {state.fieldErrors.adult}
            </p>
          )}
        </div>
      )}
      <Button type="submit" size="lg" loading={pending} className={`mt-2 ${AUTH_BUTTON}`}>
        {submitLabel}
      </Button>
      {footer}
    </form>
  );
}
