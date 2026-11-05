"use client";

import { Check, Copy, Download, ExternalLink, Mail, Trash2 } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import {
  radarAdd,
  radarDelete,
  radarMarkFollowedUp,
  radarSetDetails,
  radarSetPitch,
  radarSetStatus,
} from "@/lib/admin/radar-actions";
import { cn } from "@/lib/cn";
import {
  RADAR_CATEGORIES,
  RADAR_STAGES,
  RADAR_TABS,
  bucket,
  daysBetween,
  followUpDue,
  followUpEmail,
  followUpIn,
  hasEmail,
  hasPlaceholder,
  inTab,
  isPast,
  outreachWindow,
  partnerEmail,
  shortDate,
  timing,
  type Email,
  type RadarEvent,
  type RadarPitch,
  type RadarStatus,
  type RadarTab,
} from "@/lib/radar";

type Props = { events: RadarEvent[]; pitch: RadarPitch; today: string };
type Where = "all" | "in person" | "online";
type Mail = "all" | "yes" | "no";

/** The partner radar: pitch, filters, the events and the add form. */
export function RadarBoard({ events, pitch, today }: Props) {
  const [tab, setTab] = useState<RadarTab>(() => (events.some((e) => followUpDue(e, today)) ? "followup" : "todo"));
  const [view, setView] = useState<"cards" | "sheet">("cards");
  const [where, setWhere] = useState<Where>("all");
  const [mail, setMail] = useState<Mail>("all");

  const counts = useMemo(() => {
    const n: Record<RadarTab, number> = { followup: 0, todo: 0, active: 0, done: 0, past: 0, all: events.length };
    for (const e of events) {
      n[bucket(e, today)]++;
      if (followUpDue(e, today)) n.followup++;
    }
    return n;
  }, [events, today]);
  const withEmail = events.filter(hasEmail).length;

  const shown = events
    .filter((e) => inTab(e, tab, today))
    .filter((e) => where === "all" || e.format === where)
    .filter((e) => mail === "all" || (mail === "yes") === hasEmail(e))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (tab === "past") shown.reverse();

  const win = outreachWindow(today);

  return (
    <>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <span>
          Today <b className="font-medium text-ink">{shortDate(today)}</b>
        </span>
        <span>
          Best outreach window: events on{" "}
          <b className="font-medium text-ink">
            {shortDate(win.from)} to {shortDate(win.to)}
          </b>
        </span>
      </p>

      <PitchBox pitch={pitch} />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="View" value={view} onChange={setView} items={[["cards", "Cards"], ["sheet", "Sheet"]]} />
        <Segmented label="Where" value={where} onChange={setWhere} items={[["all", "All"], ["in person", "In person"], ["online", "Online"]]} />
        <Segmented
          label="Contact"
          value={mail}
          onChange={setMail}
          items={[
            ["all", "Any contact"],
            ["yes", <>Has email <Count n={withEmail} /></>],
            ["no", <>No email <Count n={events.length - withEmail} /></>],
          ]}
        />
        <a href="/admin/radar/export" className={buttonClass({ variant: "ghost", size: "sm" })}>
          <Download className="size-4" aria-hidden />
          Download for Excel
        </a>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
        {RADAR_TABS.filter((t) => t.value !== "followup" || counts.followup > 0 || tab === "followup").map((t) => (
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
                tab === t.value ? "opacity-75" : t.value === "followup" ? "font-semibold text-danger" : "font-normal text-ink-3",
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
            title={events.length ? (tab === "followup" ? "No follow-ups due right now" : "Nothing in this list right now") : "No events yet"}
            description={events.length ? "Try another tab or filter." : "The Monday search adds new events here, or add one below."}
          />
        </div>
      ) : view === "sheet" ? (
        <Sheet events={shown} today={today} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((e) => (
            // Keyed on the saved notes and email too, so the boxes start fresh when they change elsewhere
            <EventCard key={`${e.id}:${e.notes ?? ""}:${e.contact ?? ""}`} event={e} pitch={pitch} today={today} />
          ))}
        </ul>
      )}

      <AddEvent />

      <p className="text-sm text-ink-3">
        Stages: <b className="font-medium text-ink-2">New</b> not contacted yet · <b className="font-medium text-ink-2">Contacted</b> email
        sent · <b className="font-medium text-ink-2">Talking</b> they replied · <b className="font-medium text-ink-2">Agreed</b> partnership on ·{" "}
        <b className="font-medium text-ink-2">Declined</b> not this time. Three days after you mark an event Contacted with no reply, it shows
        Follow-up due with a short follow-up email. Each event gets one follow-up. If an organiser replies &quot;No thanks&quot;, set it to
        Declined and it won&apos;t come up again.
      </p>
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-normal tabular-nums opacity-80">{n}</span>;
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

/** The pitch, written once and dropped into every partner email. Saved when you leave a box. */
function PitchBox({ pitch }: { pitch: RadarPitch }) {
  const toast = useToast();
  const [value, setValue] = useState(pitch);
  const [saved, setSaved] = useState("");
  const [, start] = useTransition();
  const missing = !pitch.pitch.trim();
  const save = () => {
    if (value.pitch === pitch.pitch && value.offer === pitch.offer && value.sender === pitch.sender) return;
    setSaved("Saving…");
    start(async () => {
      const res = await radarSetPitch(value.pitch, value.offer, value.sender);
      if (res.error) {
        setSaved("");
        toast(res.error, "error");
      } else setSaved("Saved. Every email is updated.");
    });
  };
  const set = (k: keyof RadarPitch) => (e: { target: { value: string } }) => setValue((v) => ({ ...v, [k]: e.target.value }));

  return (
    <details open={missing} className="rounded-xl border border-accent/40 bg-surface px-4 py-3.5">
      <summary className="cursor-pointer font-medium text-ink">
        Your Meetwell pitch {missing && <span className="ml-1.5 text-sm font-medium text-danger">Needs filling in</span>}
      </summary>
      <p className="mt-1 text-sm text-ink-2">Write these once. They go into every partner email below.</p>
      <div className="mt-3 grid gap-3">
        <Field label="What Meetwell is (2 or 3 sentences)">
          {({ id }) => <Textarea id={id} rows={3} maxLength={2000} value={value.pitch} onChange={set("pitch")} onBlur={save} />}
        </Field>
        <Field label="What you offer the organiser">
          {({ id }) => <Textarea id={id} rows={2} maxLength={2000} value={value.offer} onChange={set("offer")} onBlur={save} />}
        </Field>
        <Field label="Your name and role" hint="Put the role on a second line.">
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} rows={2} maxLength={200} value={value.sender} onChange={set("sender")} onBlur={save} className="min-h-0!" />
          )}
        </Field>
        {saved && <p className="text-sm text-ink-3" aria-live="polite">{saved}</p>}
      </div>
    </details>
  );
}

const TIMING_TONE = { past: "neutral", late: "danger", good: "accent", early: "neutral" } as const;

function EventCard({ event: e, pitch, today }: { event: RadarEvent; pitch: RadarPitch; today: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [mailOpen, setMailOpen] = useState<"first" | "followup" | null>(null);
  const [notes, setNotes] = useState(e.notes ?? "");
  const [contact, setContact] = useState(e.contact ?? "");
  const [saved, setSaved] = useState("");

  const t = timing(e, today);
  const due = followUpDue(e, today);
  const fu = followUpIn(e, today);
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
    if (notes === (e.notes ?? "") && contact === (e.contact ?? "")) return;
    run(() => radarSetDetails(e.id, notes, contact));
  };
  const range = e.end_date && e.end_date !== e.start_date ? ` · runs to ${shortDate(e.end_date)}` : "";

  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[4rem_1fr]">
      <div className="flex items-baseline gap-2 sm:row-span-3 sm:flex-col sm:items-center sm:gap-0 sm:border-r sm:border-border sm:pr-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
          {new Date(`${e.start_date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
        </span>
        <span className="text-2xl font-semibold leading-none tabular-nums text-ink sm:text-3xl">{+e.start_date.slice(8, 10)}</span>
        <span className="text-xs text-ink-3">
          {new Date(`${e.start_date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h2 className="min-w-0 text-lg font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{e.name}</h2>
        {hasEmail(e) ? <Badge tone="accent">Has email</Badge> : <Badge tone="warning">No email</Badge>}
        {e.format === "online" && <Badge>Online</Badge>}
        <Badge tone={TIMING_TONE[t.tone]}>{t.text}</Badge>
        {due && <Badge tone="danger">Follow-up due</Badge>}
        {fu !== null && fu > 0 && <Badge tone="warning">Follow up in {fu} day{fu === 1 ? "" : "s"}</Badge>}
        {e.followed_up_on && e.status === "contacted" && <Badge tone="warning">Followed up {shortDate(e.followed_up_on)}</Badge>}
      </div>

      <p className="min-w-0 text-sm text-ink-2 [overflow-wrap:anywhere]">
        {[e.category, e.venue].filter(Boolean).join(" · ")}
        {range}
        {e.organizer && (
          <>
            <br />
            Organiser: {e.organizer}
          </>
        )}
        <br />
        {hasEmail(e) ? (
          <>
            Send to: <b className="font-medium text-ink">{e.contact}</b>
          </>
        ) : (
          <>No email found. Find one on the event page or their social pages, then add it below.</>
        )}
        {e.contacted_on && e.status !== "new" && (
          <>
            <br />
            First email sent {shortDate(e.contacted_on)}
            {e.followed_up_on && <> · follow-up sent {shortDate(e.followed_up_on)}</>}
          </>
        )}
      </p>
      {e.angle && (
        <p className="min-w-0 text-[15px] text-ink sm:col-start-2">
          <b className="font-medium">Why Meetwell fits:</b> {e.angle}
        </p>
      )}

      <div className="mt-2.5 flex flex-col gap-3 border-t border-dashed border-border pt-3 sm:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`Stage for ${e.name}`}
            value={e.status}
            disabled={pending}
            onChange={(ev) => run(() => radarSetStatus(e.id, ev.target.value as RadarStatus))}
            className="h-9! w-auto! rounded-lg! text-sm!"
          >
            {RADAR_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant={mailOpen === "first" ? "primary" : "secondary"}
            icon={<Mail className="size-4" />}
            aria-expanded={mailOpen === "first"}
            onClick={() => setMailOpen(mailOpen === "first" ? null : "first")}
          >
            Partner email
          </Button>
          {due && (
            <Button
              size="sm"
              variant={mailOpen === "followup" ? "danger" : "secondary"}
              icon={<Mail className="size-4" />}
              aria-expanded={mailOpen === "followup"}
              onClick={() => setMailOpen(mailOpen === "followup" ? null : "followup")}
              className={mailOpen === "followup" ? undefined : "border-danger text-danger"}
            >
              Follow-up email
            </Button>
          )}
          {e.link && (
            <a
              href={e.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-surface-2"
            >
              {hasEmail(e) ? "Event page" : "Find a contact"} <ExternalLink className="size-3.5" aria-hidden />
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
              if (confirm(`Remove ${e.name} from the radar?`)) run(() => radarDelete(e.id), "Removed");
            }}
          >
            Remove
          </Button>
        </div>

        {mailOpen && (
          <MailBox
            email={mailOpen === "followup" ? followUpEmail(e, pitch) : partnerEmail(e, pitch)}
            to={hasEmail(e) ? e.contact : null}
            followUp={mailOpen === "followup"}
            onSent={() => {
              setMailOpen(null);
              run(() => radarMarkFollowedUp(e.id));
            }}
          />
        )}

        <div className="grid gap-2 sm:grid-cols-[16rem_1fr]">
          <Input
            aria-label={`Organiser email for ${e.name}`}
            placeholder="Organiser's email"
            value={contact}
            maxLength={200}
            onChange={(ev) => setContact(ev.target.value)}
            onBlur={saveDetails}
            className="h-10! rounded-lg! text-sm!"
          />
          <Textarea
            aria-label={`Notes for ${e.name}`}
            placeholder="Notes: who you spoke to, next step…"
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

/** The email, ready to copy into the mail app. Placeholders still to fill in are highlighted. */
function MailBox({ email, to, followUp, onSent }: { email: Email; to: string | null; followUp: boolean; onSent: () => void }) {
  const [copied, setCopied] = useState(false);
  const marked = (text: string) =>
    text.split(/(\[[^\]]+\])/).map((part, i) =>
      /^\[[^\]]+\]$/.test(part) ? (
        <mark key={i} className="rounded bg-danger-soft px-0.5 text-danger">
          {part}
        </mark>
      ) : (
        part
      ),
    );

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-bg p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
        {followUp ? "Follow-up · reply to your first email so it stays in the same thread" : "First email"}
      </p>
      <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">
        To: {to ? <span className="text-ink">{to}</span> : <mark className="rounded bg-danger-soft px-0.5 text-danger">[no email found yet]</mark>}
        <br />
        From: hello@meetwell.me
        <br />
        Subject: <span className="font-medium text-ink">{marked(email.subject)}</span>
      </p>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">{marked(email.body)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          onClick={async () => {
            await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy email"}
        </Button>
        {followUp && (
          <Button size="sm" variant="secondary" onClick={onSent}>
            I sent the follow-up
          </Button>
        )}
        {hasPlaceholder(email.body) && <span className="text-sm text-danger">Fill in the highlighted parts in Your Meetwell pitch first.</span>}
      </div>
    </div>
  );
}

function Sheet({ events, today }: { events: RadarEvent[]; today: string }) {
  const stage = (v: RadarStatus) => RADAR_STAGES.find((s) => s.value === v)?.label;
  const follow = (e: RadarEvent) => {
    const d = followUpIn(e, today);
    if (d !== null) return d <= 0 ? "Due now" : `In ${d} day${d === 1 ? "" : "s"}`;
    return e.followed_up_on ? `Sent ${shortDate(e.followed_up_on)}` : "";
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="bg-accent-soft text-left">
            {["Event", "Start", "Days away", "Where", "Organiser", "Contact email", "Stage", "First email", "Follow-up", "Notes"].map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-border align-top">
              <td className="px-3 py-2 text-ink">
                {e.link ? (
                  <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {e.name}
                  </a>
                ) : (
                  e.name
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">{shortDate(e.start_date)}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">{isPast(e, today) ? "Finished" : daysBetween(today, e.start_date)}</td>
              <td className="whitespace-nowrap px-3 py-2">{e.format === "online" ? "Online" : "In person"}</td>
              <td className="px-3 py-2">{e.organizer}</td>
              <td className="px-3 py-2">{hasEmail(e) ? e.contact : <Badge tone="warning">No email</Badge>}</td>
              <td className="whitespace-nowrap px-3 py-2">{stage(e.status)}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">{e.status !== "new" && e.contacted_on ? shortDate(e.contacted_on) : ""}</td>
              <td className="whitespace-nowrap px-3 py-2">{follow(e)}</td>
              <td className="max-w-72 px-3 py-2 text-ink-2">{e.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddEvent() {
  const [state, action, pending] = useActionState(radarAdd, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <details className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <summary className="cursor-pointer font-medium text-ink">Add an event yourself</summary>
      <form ref={form} action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Event name" className="sm:col-span-2">
          {({ id }) => <Input id={id} name="name" required maxLength={160} />}
        </Field>
        <Field label="Start date">{({ id }) => <Input id={id} name="start" type="date" required />}</Field>
        <Field label="End date" optional>
          {({ id }) => <Input id={id} name="end" type="date" />}
        </Field>
        <Field label="Type">
          {({ id }) => (
            <Select id={id} name="category">
              {RADAR_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Where">
          {({ id }) => (
            <Select id={id} name="format">
              <option value="in person">In person (Lagos)</option>
              <option value="online">Online</option>
            </Select>
          )}
        </Field>
        <Field label="Venue or platform" optional>
          {({ id }) => <Input id={id} name="venue" maxLength={200} placeholder="Landmark Centre, or Zoom" />}
        </Field>
        <Field label="Organiser" optional>
          {({ id }) => <Input id={id} name="organizer" maxLength={200} />}
        </Field>
        <Field label="Event link" optional>
          {({ id }) => <Input id={id} name="link" type="url" maxLength={500} placeholder="https://" />}
        </Field>
        <Field label="Organiser's email" optional>
          {({ id }) => <Input id={id} name="contact" maxLength={200} />}
        </Field>
        <Field label="Why Meetwell fits" optional className="sm:col-span-2">
          {({ id }) => <Textarea id={id} name="angle" rows={2} maxLength={1000} />}
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={pending}>
            Add to radar
          </Button>
          {(state.error || state.ok) && <p className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>}
        </div>
      </form>
    </details>
  );
}
