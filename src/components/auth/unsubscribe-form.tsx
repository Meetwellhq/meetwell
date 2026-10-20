"use client";

import { useActionState } from "react";
import { AUTH_BUTTON } from "@/components/auth/auth-section";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { unsubscribeFromUpdates } from "@/lib/auth/actions";

/** A button, not an automatic action, so email link scanners can't unsubscribe people. */
export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeFromUpdates, {});

  if (state.done) {
    return (
      <Alert tone="success">
        Done. You won&apos;t get Meetwell updates anymore. You&apos;re still on the waiting list, and we&apos;ll
        still email your invite when your spot is ready.
      </Alert>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Button type="submit" loading={pending} className={AUTH_BUTTON}>
        Unsubscribe from updates
      </Button>
    </form>
  );
}
