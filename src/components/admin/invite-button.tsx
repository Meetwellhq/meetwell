"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { inviteFromWaitlist } from "@/lib/admin/actions";

/** Invite (or re-send to) one person on the waiting list. */
export function InviteButton({ email, fullName, invited }: { email: string; fullName: string | null; invited: boolean }) {
  const [state, action, pending] = useActionState(inviteFromWaitlist, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="fullName" value={fullName ?? ""} />
      <Button type="submit" size="sm" variant={invited ? "secondary" : "primary"} loading={pending}>
        {state.ok ? "Sent" : invited ? "Resend" : "Invite"}
      </Button>
      {state.error && <p className="max-w-[16rem] text-right text-xs text-danger">{state.error}</p>}
    </form>
  );
}
