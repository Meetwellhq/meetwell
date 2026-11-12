"use client";

import { useActionState } from "react";
import { AUTH_BUTTON } from "@/components/auth/auth-section";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { unsubscribeSavebackEmails } from "@/lib/contacts/actions";

/** A button, not an automatic action, so email link scanners can't switch emails off. */
export function SavebackEmailsOffForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeSavebackEmails, {});
  if (state.done) {
    return <Alert tone="success">Done. You won&apos;t get emails when someone saves your card back.</Alert>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Button type="submit" loading={pending} className={AUTH_BUTTON}>
        Turn off save-back emails
      </Button>
    </form>
  );
}
