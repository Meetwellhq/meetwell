"use client";

import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { adminAddOutreach, adminDeleteOutreach, adminSetOutreachStatus, type OutreachStatus } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

export function AddOutreachForm() {
  const [state, action, pending] = useActionState(adminAddOutreach, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
      <Field label="First name">
        {({ id }) => <Input id={id} name="firstName" maxLength={40} required placeholder="Daniel" />}
      </Field>
      <Field label="X handle or profile link">
        {({ id }) => <Input id={id} name="handle" maxLength={120} required placeholder="@danbuilds" />}
      </Field>
      <Field label="Why they fit" optional>
        {({ id }) => <Input id={id} name="note" maxLength={300} placeholder="Backend lead at a fintech, 6 years" />}
      </Field>
      <Button type="submit" loading={pending}>Add</Button>
      {(state.error || state.ok) && (
        <p className={cn("text-sm sm:col-span-4", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}

export function CopyMessageButton({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      onClick={async () => {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : "Copy message"}
    </Button>
  );
}

export function OpenOnX({ handle }: { handle: string }) {
  return (
    <a
      href={`https://x.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      Open on X <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

const STEPS: { status: OutreachStatus; label: string }[] = [
  { status: "to_contact", label: "To contact" },
  { status: "contacted", label: "Messaged" },
  { status: "replied", label: "Replied" },
  { status: "declined", label: "Not interested" },
];

export function OutreachStatusPicker({ id, status }: { id: number; status: OutreachStatus }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-full bg-surface-2 p-1", pending && "opacity-60")} role="group" aria-label="Status">
      {STEPS.map((s) => (
        <button
          key={s.status}
          type="button"
          disabled={pending}
          aria-pressed={status === s.status}
          onClick={() =>
            start(async () => {
              const res = await adminSetOutreachStatus(id, s.status);
              if (res.error) toast(res.error, "error");
            })
          }
          className={cn(
            "rounded-full px-2.5 py-1 text-xs transition-colors",
            status === s.status ? "bg-accent font-medium text-white" : "text-ink-2 hover:text-ink",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function RemoveOutreach({ id, name }: { id: number; name: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove ${name} from the list?`)) return;
        start(async () => {
          const res = await adminDeleteOutreach(id);
          if (res.error) toast(res.error, "error");
        });
      }}
      className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
