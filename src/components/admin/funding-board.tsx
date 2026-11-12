"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { fundingAdd, fundingDelete, fundingSetDetails, fundingSetStatus } from "@/lib/admin/funding-actions";
import { cn } from "@/lib/cn";
import {
  FUNDING_KINDS,
  FUNDING_REGIONS,
  FUNDING_STAGES,
  FUNDING_TABS,
  bucket,
  byDeadline,
  closingSoon,
  deadlineText,
  inTab,
  kindLabel,
  type Funding,
  type FundingRegion,
  type FundingStatus,
  type FundingTab,
} from "@/lib/funding";
import { shortDate } from "@/lib/radar";

type Props = { items: Funding[]; today: string };
type Where = "all" | FundingRegion;
type Equity = "all" | "free";

/** The funding radar: filters, the opportunities and the add form. */
export function FundingBoard({ items, today }: Props) {
  const [tab, setTab] = useState<FundingTab>(() => (items.some((f) => closingSoon(f, today)) ? "soon" : "review"));
  const [where, setWhere] = useState<Where>("all");
  const [equity, setEquity] = useState<Equity>("all");

  const counts = useMemo(() => {
    const n: Record<FundingTab, number> = { soon: 0, review: 0, preparing: 0, applied: 0, done: 0, closed: 0, all: items.length };
    for (const f of items) {
      n[bucket(f, today)]++;
      if (closingSoon(f, today)) n.soon++;
    }
    return n;
  }, [items, today]);

  const shown = items
    .filter((f) => inTab(f, tab, today))
    .filter((f) => where === "all" || f.region === where)
    .filter((f) => equity === "all" || f.equity_free === true)
    .sort(byDeadline);
  if (tab === "closed" || tab === "done") shown.reverse();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Who it's for"
          value={where}
          onChange={setWhere}
          items={[["all", "Anywhere"], ...FUNDING_REGIONS.map((r): [Where, ReactNode] => [r, r === "Global" ? "Worldwide" : r])]}
        />
        <Segmented label="Equity" value={equity} onChange={setEquity} items={[["all", "Any"], ["free", "Equity-free only"]]} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
        {FUNDING_TABS.filter((t) => t.value !== "soon" || counts.soon > 0 || tab === "soon").map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink hover:bg-surface-2",
            )}
          >
            {t.label}
            <span
              className={cn(
                "tabular-nums",
                tab === t.value ? "opacity-75" : t.value === "soon" ? "font-semibold text-danger" : "font-normal text-ink-3",
              )}
            >
              {counts[t.value]}
            </span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            title={items.length ? "Nothing in this list right now" : "No opportunities yet"}
            description={items.length ? "Try another tab or filter." : "The Monday search adds grants and programmes here, or add one below."}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((f) => (
            // Keyed on the saved notes and deadline too, so the boxes start fresh when they change elsewhere
            <FundingCard key={`${f.id}:${f.notes ?? ""}:${f.deadline ?? ""}`} item={f} today={today} />
          ))}
        </ul>
      )}

      <AddFunding />

      <p className="text-sm text-ink-3">
        Stages: <b className="font-medium text-ink-2">New</b> not looked at yet · <b className="font-medium text-ink-2">Preparing</b> working
        on the application · <b className="font-medium text-ink-2">Applied</b> sent · <b className="font-medium text-ink-2">Shortlisted</b>{" "}
        through to the next round · <b className="font-medium text-ink-2">Won</b>, <b className="font-medium text-ink-2">Not this time</b> or{" "}
        <b className="font-medium text-ink-2">Skipped</b> when it&apos;s not a fit. Always check the details on the funder&apos;s own page
        before applying: deadlines and rules change.
      </p>
    </>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  items: [T, ReactNode][];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-border bg-surface">
      {items.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
            value === v ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const DEADLINE_TONE = { past: "neutral", late: "danger", soon: "warning", fine: "accent", rolling: "neutral" } as const;

function FundingCard({ item: f, today }: { item: Funding; today: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(f.notes ?? "");
  const [deadline, setDeadline] = useState(f.deadline ?? "");
  const [saved, setSaved] = useState("");
  const d = deadlineText(f, today);

  const run = (fn: () => Promise<{ error?: string }>, ok = "Saved") => {
    setSaved("Saving…");
    start(async () => {
      const res = await fn();
      if (res.error) {
        setSaved("");
        toast(res.error, "error");
      } else setSaved(ok);
    });
  };
  const saveDetails = () => {
    if (notes === (f.notes ?? "") && deadline === (f.deadline ?? "")) return;
    run(() => fundingSetDetails(f.id, notes, deadline));
  };

  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h2 className="min-w-0 text-lg font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{f.name}</h2>
        <Badge tone={DEADLINE_TONE[d.tone]}>{d.text}</Badge>
        <Badge>{kindLabel(f.kind)}</Badge>
        {f.equity_free === true && <Badge tone="success">Equity-free</Badge>}
        {f.equity_free === false && <Badge tone="warning">Takes equity</Badge>}
      </div>

      <p className="min-w-0 text-sm text-ink-2 [overflow-wrap:anywhere]">
        {[f.funder, f.region === "Global" ? "Worldwide" : f.region].filter(Boolean).join(" · ")}
        {f.amount && (
          <>
            <br />
            <b className="font-medium text-ink">{f.amount}</b>
          </>
        )}
        {f.applied_on && f.status !== "new" && f.status !== "preparing" && (
          <>
            <br />
            Applied {shortDate(f.applied_on)}
          </>
        )}
      </p>

      {f.fit && (
        <p className="min-w-0 text-[15px] text-ink">
          <b className="font-medium">Why it fits Meetwell:</b> {f.fit}
        </p>
      )}
      {f.eligibility && (
        <p className="min-w-0 text-[15px] text-ink">
          <b className="font-medium">Who can apply:</b> {f.eligibility}
        </p>
      )}
      {f.prepare && (
        <p className="min-w-0 text-[15px] text-ink">
          <b className="font-medium">What to prepare:</b> {f.prepare}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-3 border-t border-dashed border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`Stage for ${f.name}`}
            value={f.status}
            disabled={pending}
            onChange={(ev) => run(() => fundingSetStatus(f.id, ev.target.value as FundingStatus))}
            className="h-9! w-auto! rounded-lg! text-sm!"
          >
            {FUNDING_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          {f.link && (
            <a
              href={f.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-surface-2"
            >
              Details and how to apply <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          <span className="text-sm text-ink-3" aria-live="polite">
            {saved}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              if (confirm(`Remove ${f.name} from the funding radar?`)) run(() => fundingDelete(f.id), "Removed");
            }}
          >
            Remove
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
          <Input
            type="date"
            aria-label={`Deadline for ${f.name}`}
            value={deadline}
            onChange={(ev) => setDeadline(ev.target.value)}
            onBlur={saveDetails}
            className="h-10! rounded-lg! text-sm!"
          />
          <Textarea
            aria-label={`Notes for ${f.name}`}
            placeholder="Notes: what they ask for, who you spoke to, next step…"
            value={notes}
            maxLength={4000}
            rows={1}
            onChange={(ev) => setNotes(ev.target.value)}
            onBlur={saveDetails}
            className="min-h-10! rounded-lg! py-2! text-sm!"
          />
        </div>
      </div>
    </li>
  );
}

function AddFunding() {
  const [state, action, pending] = useActionState(fundingAdd, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <details className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <summary className="cursor-pointer font-medium text-ink">Add one yourself</summary>
      <form ref={form} action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name of the grant or programme" className="sm:col-span-2">
          {({ id }) => <Input id={id} name="name" required maxLength={160} />}
        </Field>
        <Field label="Who runs it" optional>
          {({ id }) => <Input id={id} name="funder" maxLength={200} />}
        </Field>
        <Field label="Type">
          {({ id }) => (
            <Select id={id} name="kind">
              {FUNDING_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Amount" optional>
          {({ id }) => <Input id={id} name="amount" maxLength={160} placeholder="Up to $50,000" />}
        </Field>
        <Field label="Do they take shares?">
          {({ id }) => (
            <Select id={id} name="equity" defaultValue="">
              <option value="">Not sure</option>
              <option value="yes">No, equity-free</option>
              <option value="no">Yes, they take equity</option>
            </Select>
          )}
        </Field>
        <Field label="Deadline" optional hint="Leave empty if it's rolling.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="deadline" type="date" />}
        </Field>
        <Field label="Who it's for">
          {({ id }) => (
            <Select id={id} name="region" defaultValue="Africa">
              {FUNDING_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "Global" ? "Worldwide" : r}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Link" optional className="sm:col-span-2">
          {({ id }) => <Input id={id} name="link" type="url" maxLength={500} placeholder="https://" />}
        </Field>
        <Field label="Who can apply" optional className="sm:col-span-2">
          {({ id }) => <Textarea id={id} name="eligibility" rows={2} maxLength={1500} />}
        </Field>
        <Field label="Why it fits Meetwell" optional className="sm:col-span-2">
          {({ id }) => <Textarea id={id} name="fit" rows={2} maxLength={1500} />}
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={pending}>
            Add to funding radar
          </Button>
          {(state.error || state.ok) && <p className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>}
        </div>
      </form>
    </details>
  );
}
