"use client";

import { MessageSquareText } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { sendFeedback, type FeedbackState } from "@/lib/feedback/actions";

const KINDS = [
  { value: "idea", label: "Idea" },
  { value: "problem", label: "Problem" },
  { value: "other", label: "Other" },
] as const;

/**
 * A round feedback button in the dashboard header. It opens a small window:
 * pick Idea, Problem or Other from a drop-down, write a message, and it's emailed to support
 * (replying answers the member). The form starts fresh each time it opens.
 */
export function FeedbackButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          setRound((n) => n + 1);
          setOpen(true);
        }}
        aria-label="Send feedback"
        title="Send feedback"
        className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2 hover:bg-border hover:text-ink"
      >
        <MessageSquareText className="size-4" aria-hidden />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Send feedback"
        description="Tell us what's working, what isn't, or what you'd like to see. It goes straight to the Meetwell team."
      >
        {open && <FeedbackForm key={round} onDone={() => setOpen(false)} />}
      </Dialog>
    </div>
  );
}

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("idea");
  // Kept in state so the text stays if sending fails (forms clear themselves after an action).
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">Thanks! We read every message, and we&apos;ll reply by email if we have a question.</Alert>
        <div>
          <Button type="button" onClick={onDone}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="page" value={pathname} />
      <Field label="Type">
        {({ id }) => (
          <Select id={id} name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Message">
        {({ id }) => (
          <Textarea
            id={id}
            name="message"
            required
            minLength={3}
            maxLength={2000}
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            autoFocus
            placeholder={kind === "problem" ? "What happened, and what did you expect?" : "What's on your mind?"}
          />
        )}
      </Field>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>Send</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
