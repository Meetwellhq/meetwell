"use client";

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
 * The Ideas window (feedback), opened from the avatar menu: pick Idea, Problem or Other
 * from a drop-down, write a message, and it's emailed to support (replying
 * answers the member). The form starts fresh each time it opens.
 */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share an idea"
      description="Got an idea that would make Meetwell better for you? Tell us. It goes straight to the Meetwell team."
    >
      {open && <FeedbackForm onDone={onClose} />}
    </Dialog>
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
        <Alert tone="success">Thanks for sharing! We read every idea, and we&apos;ll email you if we have a question.</Alert>
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
            placeholder={kind === "problem" ? "What happened, and what did you expect?" : kind === "idea" ? "What would you like Meetwell to do?" : "What's on your mind?"}
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
