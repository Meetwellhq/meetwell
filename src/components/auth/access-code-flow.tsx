"use client";

import { useActionState } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AUTH_BUTTON } from "@/components/auth/auth-section";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signUp, verifyAccessCode } from "@/lib/auth/actions";

/** Invite sign-up: check the access code first, then create the account with it. */
export function AccessCodeFlow() {
  const [state, formAction, pending] = useActionState(verifyAccessCode, {});

  if (state.code) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          Code accepted. Now create your account.
        </p>
        <AuthForm
          action={signUp}
          submitLabel="Create account"
          hideOnMessage
          hidden={{ accessCode: state.code }}
          fields={[
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters" },
          ]}
        />
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field label="Access code" error={state.error}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="code"
            defaultValue={state.input}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="e.g. MEETWELL-7KQ2-XR4P"
            className="font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
            aria-describedby={describedBy}
            invalid={invalid}
            required
          />
        )}
      </Field>
      <Button type="submit" loading={pending} className={`mt-2 ${AUTH_BUTTON}`}>
        Continue
      </Button>
    </form>
  );
}
