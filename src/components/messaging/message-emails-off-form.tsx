"use client";

import { useActionState } from "react";
import { AUTH_BUTTON } from "@/components/auth/auth-section";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { unsubscribeMessageEmails } from "@/lib/messaging/actions";

/** A button, not an automatic action, so email link scanners can't switch emails off. */
export function MessageEmailsOffForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeMessageEmails, {});
  if (state.done) {
    return <Alert tone="success">Done. You won&apos;t get emails about new messages.</Alert>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Button type="submit" loading={pending} className={AUTH_BUTTON}>
        Turn off message emails
      </Button>
    </form>
  );
}
