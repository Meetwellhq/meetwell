"use client";

import { Check, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  adminAddPartnerMember,
  adminCreatePartner,
  adminRecordPartnerPayout,
  adminSetPartnerActive,
} from "@/lib/admin/actions";
import { cn } from "@/lib/cn";
import { PaginatedList } from "@/components/ui/paginated-list";

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
          {({ id }) => <Input id={id} name="name" required maxLength={80} placeholder="e.g. Lagos Design Week" />}
        </Field>
        <Field label="Link name" hint="Optional. Made from the name if you leave it empty.">
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} name="slug" maxLength={40} placeholder="e.g. lagos-design-week" />
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

/** All partners, one row each. Click a row to open that partner's page. */
export function PartnerList({ rows }: { rows: PartnerRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-2">No partners yet. Add your first one above.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_1.5rem] gap-3 border-b border-border px-4 py-2.5 text-xs text-ink-3 sm:grid">
        <span>Partner</span>
        <span className="text-right">Joined</span>
        <span className="text-right">Cards</span>
        <span className="text-right">Mentors</span>
        <span />
      </div>
      <PaginatedList className="divide-y divide-border">
        {rows.map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/partners/${p.slug}`}
              className="grid grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-3 px-4 py-3.5 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_1.5rem]"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-ink">{p.name}</span>
                  {!p.active && <Badge tone="warning">Paused</Badge>}
                </span>
                <span className="block text-sm text-ink-2 sm:hidden">
                  {p.signups} joined · {p.published} cards · {p.mentors} mentors
                </span>
              </span>
              <span className="hidden text-right tabular-nums text-ink sm:block">{p.signups}</span>
              <span className="hidden text-right tabular-nums text-ink sm:block">{p.published}</span>
              <span className="hidden text-right tabular-nums text-ink sm:block">{p.mentors}</span>
              <ChevronRight className="size-4 text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </PaginatedList>
    </div>
  );
}

/** One partner's link, numbers and team, at the top of its page. */
export function PartnerSummary({ partner, site }: { partner: PartnerRow; site: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-ink">Invite link</p>
        <PauseButton partner={partner} />
      </div>
      <CopyLink link={partnerLink(site, partner.slug)} />
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-ink-2">Joined</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">
            {partner.signups}
            <span className="text-xs font-normal text-ink-3"> of {partner.max_signups}</span>
          </dd>
        </div>
        <div>
          <dt className="text-ink-2">Published a card</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{partner.published}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Mentors</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{partner.mentors}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-sm text-ink-2">
          {partner.team.length
            ? `Can see the partner page: ${partner.team.join(", ")}`
            : "Nobody from their team can see the partner page yet."}
        </p>
        <AddTeamMember partnerId={partner.id} />
      </div>
    </div>
  );
}

export type PartnerMoney = { earned_kobo: number; paid_kobo: number; available_kobo: number; pending_kobo: number };

/** Record a payout after paying the partner by bank transfer. */
export function RecordPayout({ partnerId, availableKobo }: { partnerId: string; availableKobo: number }) {
  const [state, action, pending] = useActionState(adminRecordPartnerPayout.bind(null, partnerId), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  if (availableKobo <= 0 && !state.ok) {
    return <p className="text-sm text-ink-2">Nothing is ready to pay yet.</p>;
  }
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <p className="text-sm text-ink-2">
        Paid them by bank transfer? Record it here so their page stays right.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="amount"
          inputMode="decimal"
          required
          placeholder={`Amount in naira, up to ${(availableKobo / 100).toLocaleString("en-NG")}`}
          aria-label="Amount paid in naira"
          className="h-9 text-sm sm:max-w-[16rem]"
        />
        <Input name="note" maxLength={200} placeholder="Note, e.g. October transfer" aria-label="Note" className="h-9 text-sm" />
        <Button type="submit" size="sm" variant="secondary" loading={pending}>Record payout</Button>
      </div>
      {(state.error || state.ok) && (
        <p className={cn("text-xs", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}
