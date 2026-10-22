"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendSparkAnnouncement } from "@/lib/admin/actions";

/** Sends the Spark beta email to members who haven't had it, one batch per click. */
export function AnnounceButton({ remaining }: { remaining: number }) {
  const [state, action, pending] = useActionState(sendSparkAnnouncement, {});
  const left = state.remaining ?? remaining;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!state.sent && !confirm(`Send the Spark email to ${left} user${left === 1 ? "" : "s"}?`)) e.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <Button type="submit" size="sm" loading={pending} disabled={left === 0}>
        {left === 0 ? "All sent" : state.sent ? "Send the rest" : "Send Spark email"}
      </Button>
      {state.sent !== undefined && (
        <p className="text-right text-xs text-ink-2">
          Sent {state.sent}
          {state.failed ? `, ${state.failed} failed` : ""}. {left} left.
        </p>
      )}
      {state.error && <p className="max-w-[16rem] text-right text-xs text-danger">{state.error}</p>}
    </form>
  );
}
