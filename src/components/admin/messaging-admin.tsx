"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { adminOpenConversation, adminResolveReport, adminSetPaused } from "@/lib/admin/actions";

/** Open a free test conversation between a member (under 4 years) and a mentor (4+). */
export function OpenConversationForm() {
  const [state, action, pending] = useActionState(adminOpenConversation, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <p className="font-medium text-ink">Open a test conversation</p>
        <p className="mt-0.5 text-sm text-ink-2">
          Free, for testing before payments. The member writes first. Opening it again extends the time.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
        <Field label="Member email (under 4 years)">
          {({ id }) => <Input id={id} name="member" type="email" required />}
        </Field>
        <Field label="Mentor email (4+ years)">
          {({ id }) => <Input id={id} name="mentor" type="email" required />}
        </Field>
        <Field label="Days">
          {({ id }) => <Input id={id} name="days" type="number" min={1} max={365} defaultValue={30} />}
        </Field>
      </div>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <div>
        <Button type="submit" loading={pending}>
          Open conversation
        </Button>
      </div>
    </form>
  );
}

export function ReportActions({ id, open }: { id: number; open: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  if (!open) return null;
  const run = (action: "dismiss" | "pause") =>
    start(async () => {
      const res = await adminResolveReport(id, action);
      toast(res.error ?? (action === "pause" ? "Paused their messaging." : "Report dismissed."), res.error ? "error" : undefined);
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => run("dismiss")} loading={pending}>
        Nothing wrong
      </Button>
      <Button size="sm" variant="danger" onClick={() => run("pause")} loading={pending}>
        Pause their messaging
      </Button>
    </div>
  );
}

export function PausedToggle({ email, paused }: { email: string; paused: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      {paused && <Badge tone="warning">Messaging paused</Badge>}
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await adminSetPaused(email, !paused);
            toast(res.error ?? (paused ? "Messaging turned back on." : "Messaging paused."), res.error ? "error" : undefined);
          })
        }
      >
        {paused ? "Unpause" : "Pause"}
      </Button>
    </div>
  );
}
