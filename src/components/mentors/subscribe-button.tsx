"use client";

import { useActionState } from "react";
import { AUTH_BUTTON } from "@/components/auth/auth-section";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { startFreeConversation, subscribeToMentor } from "@/lib/mentors/actions";

/** Pays through Paystack, or, for a free mentor, opens the conversation straight away. */
export function SubscribeButton({ slug, label, free = false }: { slug: string; label: string; free?: boolean }) {
  const [state, action, pending] = useActionState(free ? startFreeConversation : subscribeToMentor, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" size="lg" loading={pending} className={AUTH_BUTTON}>
        {label}
      </Button>
    </form>
  );
}
