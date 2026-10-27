"use client";

import { Download, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import {
  adminAddEventSpeaker,
  adminCreateEvent,
  adminDeleteEvent,
  adminRemoveEventSpeaker,
  adminSetEventActive,
  adminUpdateEvent,
} from "@/lib/admin/actions";
import { cn } from "@/lib/cn";
import {
  partnerAddEventSpeaker,
  partnerCreateEvent,
  partnerRemoveEventSpeaker,
  partnerUpdateEvent,
} from "@/lib/partners/actions";

/**
 * The same event tools for admins and for a partner's own team (Partner tab).
 * Partners can't hide or delete events; their actions check team membership.
 */
const ACTIONS = {
  admin: { create: adminCreateEvent, update: adminUpdateEvent, add: adminAddEventSpeaker, remove: adminRemoveEventSpeaker },
  team: { create: partnerCreateEvent, update: partnerUpdateEvent, add: partnerAddEventSpeaker, remove: partnerRemoveEventSpeaker },
};
type Who = keyof typeof ACTIONS;

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
  /** Conversations with free mentors started from this page. */
  free_conversations?: number;
};

/**
 * Date, About and Venue, after the name and link fields. One date per event;
 * About is a big box that fills the right column next to Date and Venue.
 */
function EventDetails({ event }: { event?: AdminEvent }) {
  return (
    <>
      <Field label="Date">
        {({ id }) => <Input id={id} name="startsOn" type="date" required defaultValue={event?.starts_on} />}
      </Field>
      <Field label="About" hint="Optional. A few lines about the event." className="sm:row-span-2">
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            name="about"
            maxLength={600}
            defaultValue={event?.about ?? ""}
            placeholder={event ? undefined : "A day of talks on product design in Africa."}
            className="min-h-28 flex-1 resize-none"
          />
        )}
      </Field>
      <Field label="Venue" hint="Optional.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            name="venue"
            maxLength={120}
            defaultValue={event?.venue ?? ""}
            placeholder={event ? undefined : "Landmark Centre, Lagos"}
          />
        )}
      </Field>
    </>
  );
}

/** New event page for this partner: name, date, venue, a short description. */
export function AddEvent({ partnerSlug, who = "admin" }: { partnerSlug: string; who?: Who }) {
  const [state, action, pending] = useActionState(ACTIONS[who].create.bind(null, partnerSlug), {});
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
        <EventDetails />
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
function EditEvent({ event, who, onDone }: { event: AdminEvent; who: Who; onDone: () => void }) {
  const [state, action, pending] = useActionState(ACTIONS[who].update.bind(null, event.slug), {});
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
        <EventDetails event={event} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" loading={pending}>Save changes</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}

function AddSpeaker({ eventSlug, who }: { eventSlug: string; who: Who }) {
  const [state, action, pending] = useActionState(ACTIONS[who].add.bind(null, eventSlug), {});
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

/**
 * One speaker on an event. Remove hides the row at once (the save takes a moment)
 * and says so; if it fails, the row comes back with the error.
 */
function SpeakerRow({ eventSlug, who, speaker: s }: { eventSlug: string; who: Who; speaker: AdminEvent["speakers"][number] }) {
  const toast = useToast();
  const [removed, setRemoved] = useState(false);
  const [, start] = useTransition();
  if (removed) return null;
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.full_name}</span>
      {s.mentor && <Badge tone="accent">Mentor</Badge>}
      {s.status !== "published" && <Badge tone="warning">Card not published</Badge>}
      <a href={`/e/${eventSlug}/qr?speaker=${encodeURIComponent(s.slug)}`} className="text-xs text-ink-3 hover:text-ink">Badge QR</a>
      <button
        type="button"
        aria-label={`Remove ${s.full_name}`}
        onClick={() => {
          setRemoved(true);
          start(async () => {
            const { error } = await ACTIONS[who].remove(eventSlug, s.slug);
            if (error) {
              setRemoved(false);
              toast(error, "error");
            } else toast(`Removed ${s.full_name}.`);
          });
        }}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-3 hover:bg-danger-soft hover:text-danger"
      >
        <X className="size-3.5" aria-hidden />
        Remove
      </button>
    </li>
  );
}

/** Delete, with a confirm step. Only events nothing has come from yet; the database refuses the rest. */
function DeleteEvent({ event }: { event: AdminEvent }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const hasHistory = event.payments > 0 || (event.free_conversations ?? 0) > 0;
  return (
    <>
      <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirming(true)} className="text-danger! hover:text-danger!">
        Delete
      </Button>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete ${event.name}?`}
        description={
          hasHistory
            ? "This event already has payments or conversations, so it can't be deleted: its numbers and the partner's earnings depend on it. Hide the page instead."
            : "Its page and QR codes stop working, and its speaker list is removed. This can't be undone."
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            {hasHistory ? "Close" : "Cancel"}
          </Button>
          {!hasHistory && (
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const { error } = await adminDeleteEvent(event.slug);
                  setConfirming(false);
                  if (error) toast(error, "error");
                  else toast(`Deleted ${event.name}.`);
                })
              }
            >
              Delete event
            </Button>
          )}
        </div>
      </Dialog>
    </>
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

/**
 * One event: its page and QR, speakers (add or remove), and what it brought in.
 * Admins pass the revenue line; a partner's team (who="team") passes its own note.
 */
export function EventCard({
  event,
  site,
  dates,
  revenue,
  note,
  who = "admin",
}: {
  event: AdminEvent;
  site: string;
  dates: string;
  revenue?: string;
  note?: string;
  who?: Who;
}) {
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
          {who === "admin" && (
            <>
              <ActiveToggle event={event} />
              <DeleteEvent event={event} />
            </>
          )}
        </div>
      </div>

      {editing && <EditEvent event={event} who={who} onDone={stopEditing} />}

      {revenue !== undefined && (
        <p className="text-sm text-ink-2">
          Paid messages started from this page: <span className="font-medium text-ink">{event.payments}</span> · {revenue} · Free
          conversations: <span className="font-medium text-ink">{event.free_conversations ?? 0}</span>
        </p>
      )}
      {note && <p className="text-sm text-ink-2">{note}</p>}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">Speakers ({event.speakers.length})</p>
        {event.speakers.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {event.speakers.map((s) => (
              <SpeakerRow key={s.slug} eventSlug={event.slug} who={who} speaker={s} />
            ))}
          </ul>
        )}
        <AddSpeaker eventSlug={event.slug} who={who} />
      </div>
    </li>
  );
}
