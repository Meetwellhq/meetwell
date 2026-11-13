"use client";

import { Download, ExternalLink, Eye, EyeOff, Pencil, Send, Trash2, Upload, X } from "lucide-react";
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
  cancelSpeakerInvite,
  inviteEventSpeakers,
  partnerAddEventSpeaker,
  partnerCreateEvent,
  partnerRemoveEventSpeaker,
  partnerUpdateEvent,
  sendWaitingSpeakerInvites,
} from "@/lib/partners/actions";
import { INVITE_STATUS, MAX_SPEAKER_INVITES, parseSpeakerList, type SpeakerInvite } from "@/lib/speaker-invites";

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
  /** Everyone invited by email (bulk invites); undefined hides the section. */
  invites?: SpeakerInvite[];
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
export function AddEvent({
  partnerSlug,
  who = "admin",
  onCancel,
  onAdded,
}: {
  partnerSlug: string;
  who?: Who;
  onCancel?: () => void;
  /** Called with the success message; the panel closes and shows it as a toast. */
  onAdded?: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(ACTIONS[who].create.bind(null, partnerSlug), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    onAdded?.(state.ok);
  }, [state, onAdded]);

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
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {(state.error || (state.ok && !onAdded)) && (
          <p className={cn("text-sm", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
        )}
      </div>
    </form>
  );
}

/** "Add an event" that opens into the form; Cancel closes it, and so does adding one (Partner tab). */
export function AddEventPanel({ partnerSlug, who = "team" }: { partnerSlug: string; who?: Who }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const added = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left font-medium text-ink transition-colors hover:bg-surface-2"
      >
        Add an event
        <span className="text-sm font-normal text-ink-3">Name, date, venue</span>
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-border">
      <p className="border-b border-border px-4 py-3 font-medium text-ink">Add an event</p>
      <div className="p-4">
        <AddEvent partnerSlug={partnerSlug} who={who} onCancel={close} onAdded={added} />
      </div>
    </div>
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
      <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirming(true)} className="text-danger! hover:text-danger!" title="Delete">
        <span className="max-sm:sr-only">Delete</span>
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
      icon={event.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      title={event.active ? "Hide page" : "Show page again"}
      onClick={() =>
        start(async () => {
          const { error } = await adminSetEventActive(event.slug, !event.active);
          if (error) toast(error, "error");
        })
      }
    >
      <span className="max-sm:sr-only">{event.active ? "Hide page" : "Show page again"}</span>
    </Button>
  );
}

/**
 * Invite many speakers at once: paste names and emails, or upload a CSV from
 * Excel or Google Sheets. People with a card join straight away; everyone else
 * gets an invite email and joins the event when they make their card.
 */
function SpeakerInvites({ eventSlug, invites }: { eventSlug: string; invites: SpeakerInvite[] }) {
  const [state, action, pending] = useActionState(inviteEventSpeakers.bind(null, eventSlug), {});
  const [list, setList] = useState("");
  const [sending, startSending] = useTransition();
  const [sendNote, setSendNote] = useState<{ ok?: string; error?: string }>({});
  const toast = useToast();
  const parsed = parseSpeakerList(list);
  const waiting = invites.filter((i) => i.status === "waiting").length;
  const joined = invites.filter((i) => i.status === "joined").length;

  // Clear the box once a list has gone out (adjusting state while rendering, not in an effect).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setList("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium text-ink">Invite speakers by email</p>
        <p className="mt-0.5 text-xs text-ink-2">
          One person per line: their name and email. Or upload a CSV from Excel or Google Sheets. We email each one their own
          invite, and they appear on the event page once they set up their card. Anyone already on Meetwell is added straight away.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-2">
        <Textarea
          name="list"
          rows={5}
          value={list}
          onChange={(e) => setList(e.target.value)}
          placeholder={"Ada Obi, ada@example.com\nTunde Bello, tunde@example.com"}
          aria-label="Speakers to invite: one name and email per line"
          className="font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-2">
            <Upload className="size-4" aria-hidden />
            Upload CSV
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 500_000) return toast("That file is too big. Keep it under 500 KB.", "error");
                const text = await file.text();
                setList((v) => (v.trim() ? `${v.trim()}\n${text}` : text));
              }}
            />
          </label>
          <Button type="submit" size="sm" icon={<Send className="size-4" />} loading={pending} disabled={parsed.people.length === 0}>
            {parsed.people.length > 0 ? `Invite ${parsed.people.length} ${parsed.people.length === 1 ? "speaker" : "speakers"}` : "Invite speakers"}
          </Button>
          {parsed.people.length > MAX_SPEAKER_INVITES && (
            <span className="text-xs text-danger">Up to {MAX_SPEAKER_INVITES} at a time.</span>
          )}
          {parsed.bad.length > 0 && (
            <span className="text-xs text-danger">
              {parsed.bad.length} {parsed.bad.length === 1 ? "line has" : "lines have"} no email and will be skipped.
            </span>
          )}
        </div>
        {pending && <p className="text-xs text-ink-2">Sending invites. A long list can take up to a minute.</p>}
        {(state.error || state.ok) && (
          <p className={cn("text-xs", state.error ? "text-danger" : "text-success")}>{state.error ?? state.ok}</p>
        )}
      </form>

      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-2">
              Invited {invites.length} · Joined {joined}
            </p>
            {waiting > 0 && (
              <Button
                size="sm"
                variant="secondary"
                loading={sending}
                onClick={() =>
                  startSending(async () => {
                    setSendNote(await sendWaitingSpeakerInvites(eventSlug));
                  })
                }
              >
                Send the rest ({waiting})
              </Button>
            )}
          </div>
          {(sendNote.error || sendNote.ok) && (
            <p className={cn("text-xs", sendNote.error ? "text-danger" : "text-success")}>{sendNote.error ?? sendNote.ok}</p>
          )}
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {invites.map((i) => (
              <InviteRow key={i.email} eventSlug={eventSlug} invite={i} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InviteRow({ eventSlug, invite: i }: { eventSlug: string; invite: SpeakerInvite }) {
  const toast = useToast();
  const [gone, setGone] = useState(false);
  const [, start] = useTransition();
  if (gone) return null;
  const status = INVITE_STATUS[i.status];
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-ink">{i.full_name ?? i.email}</span>
        {i.full_name && <span className="truncate text-xs text-ink-3">{i.email}</span>}
      </span>
      <Badge tone={status.tone} className="shrink-0">{status.label}</Badge>
      {i.status !== "joined" && (
        <button
          type="button"
          aria-label={`Cancel the invite to ${i.email}`}
          onClick={() => {
            setGone(true);
            start(async () => {
              const { error } = await cancelSpeakerInvite(eventSlug, i.email);
              if (error) {
                setGone(false);
                toast(error, "error");
              } else toast(`Cancelled the invite to ${i.email}.`);
            });
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-3 hover:bg-danger-soft hover:text-danger"
        >
          <X className="size-3.5" aria-hidden />
          <span className="max-sm:sr-only">Cancel</span>
        </button>
      )}
    </li>
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
          <a href={`/e/${event.slug}/qr`} title="Download event QR" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
            <Download className="size-4" aria-hidden />
            <span className="max-sm:sr-only">Event QR</span>
          </a>
          {!editing && (
            <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)} title="Edit">
              <span className="max-sm:sr-only">Edit</span>
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
        {event.invites && <SpeakerInvites eventSlug={event.slug} invites={event.invites} />}
      </div>
    </li>
  );
}
