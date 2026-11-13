"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { removeMySpeakerCard } from "@/lib/speaker-card-removal";

export function RemoveSpeakerCard({ token }: { token: string }) {
  const [state, action, pending] = useActionState(removeMySpeakerCard, {});
  if (state.done) return <Alert tone="success">Done. {state.done}&apos;s card has been removed from Meetwell.</Alert>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" variant="danger" size="lg" loading={pending}>
        Remove my card
      </Button>
    </form>
  );
}
