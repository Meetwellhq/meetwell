"use client";

import { useActionState, type ReactNode } from "react";
import { PILL } from "@/components/auth/auth-section";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import type { AuthFormState } from "@/lib/auth/actions";

type FieldDef = {
  name: string;
  label: string;
  type: "email" | "password";
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
};

export function AuthForm({ action, fields, submitLabel, hidden, hideOnMessage, footer }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

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
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              defaultValue={f.type === "email" ? state.email : undefined}
              aria-describedby={describedBy}
              invalid={invalid}
              required
            />
          )}
        </Field>
      ))}
      <Button type="submit" size="lg" loading={pending} className={`mt-2 ${PILL}`}>
        {submitLabel}
      </Button>
      {footer}
    </form>
  );
}
