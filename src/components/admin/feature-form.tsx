"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { previewFeature, sendFeature } from "@/lib/admin/actions";

type Member = { slug: string; fullName: string };

/** Pick a member, write a note, preview the email, then send it to the waiting list. */
export function FeatureForm({ members }: { members: Member[] }) {
  const [preview, previewAction, previewing] = useActionState(previewFeature, {});
  const [result, sendAction, sending] = useActionState(sendFeature, {});
  const [slug, setSlug] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  // What was previewed must match what gets sent.
  const [previewedFor, setPreviewedFor] = useState("");
  const current = `${slug}\n${note}`;
  const previewReady = !!preview.html && previewedFor === current;
  const memberName = members.find((m) => m.slug === slug)?.fullName ?? "this member";

  return (
    <div className="flex flex-col gap-8">
      <form
        action={(formData) => {
          setPreviewedFor(current);
          return previewAction(formData);
        }}
        className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5"
      >
        <Field label="Member to feature" hint="Only members with a published card are listed.">
          {({ id, describedBy }) => (
            <Select id={id} name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} aria-describedby={describedBy} required>
              <option value="">Choose a member…</option>
              {members.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.fullName} (meetwell.me/p/{m.slug})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Your note about them" optional hint="One or two sentences in your own words. Up to 600 characters.">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              name="note"
              value={note}
              maxLength={600}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Chioma designs payment tools for small shops in Lagos, and loves meeting other founders."
              aria-describedby={describedBy}
            />
          )}
        </Field>
        {preview.error && <Alert tone="danger">{preview.error}</Alert>}
        <div>
          <Button type="submit" variant="secondary" loading={previewing} disabled={!slug}>
            Preview email
          </Button>
        </div>
      </form>

      {preview.html && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Preview</h2>
            <p className="text-sm text-ink-2">
              Subject: <strong className="text-ink">{preview.subject}</strong> · Will go to{" "}
              <strong className="text-ink">{preview.audience}</strong>{" "}
              {preview.audience === 1 ? "person" : "people"} on the waiting list (not signed up, not unsubscribed, not
              already sent this one).
            </p>
          </div>
          <iframe
            title="Email preview"
            srcDoc={preview.html}
            sandbox=""
            className="h-[640px] w-full rounded-xl border border-border bg-white"
          />

          {!previewReady && (
            <Alert>You changed the member or note. Preview again before sending.</Alert>
          )}

          <form
            action={sendAction}
            onSubmit={(e) => {
              if (!window.confirm(`Send this email about ${memberName} to ${preview.audience} people now?`)) e.preventDefault();
            }}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="note" value={note} />
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <span>I have {memberName}&apos;s permission to feature them in this email.</span>
            </label>
            {result.error && <Alert tone="danger">{result.error}</Alert>}
            {result.sent !== undefined && (
              <Alert tone={result.failed ? "danger" : "success"}>
                Sent to {result.sent} {result.sent === 1 ? "person" : "people"}
                {result.failed ? `, ${result.failed} failed (they won't be retried automatically)` : ""}.
                {result.remaining ? ` ${result.remaining} still to go: press Send again to continue.` : " Everyone has it."}
              </Alert>
            )}
            <div>
              <Button type="submit" loading={sending} disabled={!previewReady || !consent || preview.audience === 0}>
                {result.remaining ? "Send to the rest" : "Send email"}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
