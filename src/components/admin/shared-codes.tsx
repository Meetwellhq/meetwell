"use client";

import { Download } from "lucide-react";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { CopyPartnerLink } from "@/components/dashboard/copy-partner-link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { adminCreateSharedCode, adminStopSharedCode } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

export type SharedCode = {
  code: string;
  note: string | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  created_at: string;
  active: boolean;
  joined: number;
  published: number;
};

/** A new shared code: a name, the code itself, how many people, and the last day it works. */
export function CreateSharedCode() {
  const [state, action, pending] = useActionState(adminCreateSharedCode, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" hint="Only you see this.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="note" required maxLength={120} placeholder="e.g. DevFest Abeokuta 2026" />}
        </Field>
        <Field label="Code" hint="What people type. Letters, numbers and dashes.">
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} name="code" required minLength={6} maxLength={32} placeholder="e.g. devfestabk" className="uppercase placeholder:normal-case" />
          )}
        </Field>
        <Field label="How many people" hint="It stops working after this many sign-ups.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="maxUses" type="number" min={1} max={100000} required placeholder="e.g. 500" />}
        </Field>
        <Field label="Last day" hint="It works until the end of this day, Lagos time.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="endsOn" type="date" required />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>Make code</Button>
        {(state.error || state.ok) && (
          <p className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
        )}
      </div>
    </form>
  );
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

function StopCode({ code }: { code: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      className="text-danger! hover:text-danger!"
      onClick={() => {
        if (!confirm(`Turn off ${code}? Nobody new can join with it. People who already joined keep their accounts.`)) return;
        start(async () => {
          const { error } = await adminStopSharedCode(code);
          toast(error ?? `${code} is off.`, error ? "error" : undefined);
        });
      }}
    >
      Turn off
    </Button>
  );
}

/** Each shared code: its link and QR, how many joined, and how many published a card. */
export function SharedCodeList({ codes, site }: { codes: SharedCode[]; site: string }) {
  if (codes.length === 0) {
    return <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-ink-2">No shared codes yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {codes.map((c) => {
        // The last moment it works is just before expires_at (midnight after the last day).
        const lastDay = c.expires_at ? day(new Date(new Date(c.expires_at).getTime() - 1000).toISOString()) : null;
        return (
          <li key={c.code}>
            <Card className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    {c.note ?? c.code}
                    {c.active ? <Badge tone="success">On</Badge> : <Badge tone="warning">Off</Badge>}
                  </p>
                  <p className="mt-0.5 font-mono text-sm text-ink-2">{c.code}</p>
                  <p className="mt-1 text-sm text-ink-3">
                    {c.uses} of {c.max_uses} used{lastDay && <> · works until {lastDay}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/admin/codes/qr?code=${encodeURIComponent(c.code)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <Download className="size-4" aria-hidden />
                    QR code
                  </a>
                  {c.active && <StopCode code={c.code} />}
                </div>
              </div>
              <CopyPartnerLink link={`${site}/access-code?code=${encodeURIComponent(c.code)}`} />
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: "Joined", value: c.joined },
                  { label: "Published a card", value: c.published },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-sm text-ink-2">{s.label}</dt>
                    <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
