"use client";

import { Download, ExternalLink, Pencil, X } from "lucide-react";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { adminAddEventSpeaker, adminCreateEvent, adminRemoveEventSpeaker, adminSetEventActive, adminUpdateEvent } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

export type AdminEvent = {
  slug: string;
  name: string;
  starts_on: string;
  ends_on: string | null;
  venue: string | null;
  about: string | null;
  active: boolean;
  speakers: { slug: string; full_name: string; status: string; mentor: boolean }[];
  payments: number;
  revenue_kobo: number;
};

/** New event page for this partner: name, dates, venue, a short description. */
export function AddEvent({ partnerSlug }: { partnerSlug: string }) {
  const [state, action, pending] = useActionState(adminCreateEvent.bind(null, partnerSlug), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event name">
          {({ id }) => <Input id={id} name="name" required maxLength={120} placeholder="e.g. Design Summit 2026" />}
        </Field>
        <Field label="Link name" hint="Optional. Made from the name if you leave it empty.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="slug" maxLength={40} placeholder="e.g. design-summit-2026" />}
        </Field>
        <Field label="Starts">
          {({ id }) => <Input id={id} name="startsOn" type="date" required />}
        </Field>
        <Field label="Ends" hint="Optional, for events over more than one day.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="endsOn" type="date" />}
        </Field>
        <Field label="Venue" hint="Optional.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="venue" maxLength={120} placeholder="Landmark Centre, Lagos" />}
        </Field>
        <Field label="About" hint="Optional. One or two sentences.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="about" maxLength={600} placeholder="A day of talks on product design in Africa." />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>Add event</Button>
        {(state.error || state.ok) && (
          <p className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
        )}
      </div>
    </form>
  );
}

/** Edit an event in place. The link name can't change: QR codes may already be printed. */
function EditEvent({ event, onDone }: { event: AdminEvent; onDone: () => void }) {
  const [state, action, pending] = useActionState(adminUpdateEvent.bind(null, event.slug), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event name">
          {({ id }) => <Input id={id} name="name" required maxLength={120} defaultValue={event.name} />}
        </Field>
        <Field label="Link name" hint="Stays the same, so printed QR codes keep working.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={event.slug} disabled readOnly />}
        </Field>
        <Field label="Starts">
          {({ id }) => <Input id={id} name="startsOn" type="date" required defaultValue={event.starts_on} />}
        </Field>
        <Field label="Ends" hint="Optional, for events over more than one day.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="endsOn" type="date" defaultValue={event.ends_on ?? ""} />}
        </Field>
        <Field label="Venue" hint="Optional.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="venue" maxLength={120} defaultValue={event.venue ?? ""} />}
        </Field>
        <Field label="About" hint="Optional. One or two sentences.">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} name="about" maxLength={600} defaultValue={event.about ?? ""} />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" loading={pending}>Save changes</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

function AddSpeaker({ eventSlug }: { eventSlug: string }) {
  const [state, action, pending] = useActionState(adminAddEventSpeaker.bind(null, eventSlug), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input name="who" required placeholder="Their email, or card link like meetwell.me/p/ada" aria-label="Speaker's email or card link" className="h-9 text-sm" />
        <Button type="submit" size="sm" variant="secondary" loading={pending}>Add speaker</Button>
      </div>
      {(state.error || state.ok) && (
        <p className={cn("text-xs", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}

function RemoveSpeaker({ eventSlug, profileSlug, name }: { eventSlug: string; profileSlug: string; name: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Remove ${name}`}
      onClick={() =>
        start(async () => {
          const { error } = await adminRemoveEventSpeaker(eventSlug, profileSlug);
          if (error) toast(error, "error");
        })
      }
      className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}

function ActiveToggle({ event }: { event: AdminEvent }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        start(async () => {
          const { error } = await adminSetEventActive(event.slug, !event.active);
          if (error) toast(error, "error");
        })
      }
    >
      {event.active ? "Hide page" : "Show page again"}
    </Button>
  );
}

/** One event: its page and QR, speakers (add or remove), and the paid messages it brought in. */
export function EventCard({ event, site, dates, revenue }: { event: AdminEvent; site: string; dates: string; revenue: string }) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);
  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            {event.name}
            {!event.active && <Badge tone="warning">Hidden</Badge>}
          </p>
          <p className="text-sm text-ink-2">{[dates, event.venue].filter(Boolean).join(" · ")}</p>
          <a href={`/e/${event.slug}`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">
            {site.replace(/^https?:\/\//, "")}/e/{event.slug}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a href={`/e/${event.slug}/qr`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
            <Download className="size-4" aria-hidden />
            Event QR
          </a>
          {!editing && (
            <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <ActiveToggle event={event} />
        </div>
      </div>

      {editing && <EditEvent event={event} onDone={stopEditing} />}

      <p className="text-sm text-ink-2">
        Paid messages started from this page: <span className="font-medium text-ink">{event.payments}</span> · {revenue}
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">Speakers ({event.speakers.length})</p>
        {event.speakers.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {event.speakers.map((s) => (
              <li key={s.slug} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.full_name}</span>
                {s.mentor && <Badge tone="accent">Mentor</Badge>}
                {s.status !== "published" && <Badge tone="warning">Card not published</Badge>}
                <a href={`/e/${event.slug}/qr?speaker=${encodeURIComponent(s.slug)}`} className="text-xs text-ink-3 hover:text-ink">Badge QR</a>
                <RemoveSpeaker eventSlug={event.slug} profileSlug={s.slug} name={s.full_name} />
              </li>
            ))}
          </ul>
        )}
        <AddSpeaker eventSlug={event.slug} />
      </div>
    </li>
  );
}
