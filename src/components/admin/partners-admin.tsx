"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { adminAddPartnerMember, adminCreatePartner, adminSetPartnerActive } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

export type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  max_signups: number;
  created_at: string;
  signups: number;
  published: number;
  mentors: number;
  team: string[];
};

export const partnerLink = (site: string, slug: string) => `${site}/join?partner=${slug}`;

export function AddPartner() {
  const [state, action, pending] = useActionState(adminCreatePartner, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Partner name">
          {({ id }) => <Input id={id} name="name" required maxLength={80} placeholder="ThinkUX" />}
        </Field>
        <Field label="Link name" hint="Optional. Made from the name if you leave it empty.">
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} name="slug" maxLength={40} placeholder="thinkux" />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>Add partner</Button>
        {(state.error || state.ok) && (
          <p className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
        )}
      </div>
    </form>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex min-w-0 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-left text-sm text-ink hover:bg-border"
    >
      <span className="truncate font-mono text-xs">{link}</span>
      {copied ? <Check className="size-4 shrink-0 text-success" aria-hidden /> : <Copy className="size-4 shrink-0 text-ink-3" aria-hidden />}
      <span className="sr-only">{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}

function AddTeamMember({ partnerId }: { partnerId: string }) {
  const [state, action, pending] = useActionState(adminAddPartnerMember.bind(null, partnerId), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input name="email" type="email" required placeholder="name@partner.com" aria-label="Team member's email" className="h-9 text-sm" />
        <Button type="submit" size="sm" variant="secondary" loading={pending}>Give access</Button>
      </div>
      {(state.error || state.ok) && (
        <p className={cn("text-xs", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}

function PauseButton({ partner }: { partner: PartnerRow }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        start(async () => {
          const { error } = await adminSetPartnerActive(partner.id, !partner.active);
          if (error) toast(error, "error");
        })
      }
    >
      {partner.active ? "Pause link" : "Turn link back on"}
    </Button>
  );
}

export function PartnerList({ rows, site }: { rows: PartnerRow[]; site: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-2">No partners yet. Add your first one above.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((p) => (
        <div key={p.id} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="font-medium text-ink">{p.name}</p>
              {!p.active && <Badge tone="warning">Paused</Badge>}
            </div>
            <PauseButton partner={p} />
          </div>

          <CopyLink link={partnerLink(site, p.slug)} />

          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-ink-2">Joined</dt>
              <dd className="text-lg font-semibold tabular-nums text-ink">
                {p.signups}
                <span className="text-xs font-normal text-ink-3"> of {p.max_signups}</span>
              </dd>
            </div>
            <div>
              <dt className="text-ink-2">Published a card</dt>
              <dd className="text-lg font-semibold tabular-nums text-ink">{p.published}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Mentors</dt>
              <dd className="text-lg font-semibold tabular-nums text-ink">{p.mentors}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-sm text-ink-2">
              {p.team.length ? `Can see the partner page: ${p.team.join(", ")}` : "Nobody from their team can see the partner page yet."}
            </p>
            <AddTeamMember partnerId={p.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
