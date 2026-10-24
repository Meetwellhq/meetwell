"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendCampaign, sendCampaignTest } from "@/lib/admin/actions";
import { audienceParams, INACTIVE_DAYS, RESEND_DAYS, TEMPLATES, type Audience } from "@/lib/admin/campaigns";

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors hover:border-border-strong focus:border-accent focus:outline-none";

/**
 * Pick the email and who gets it. Every change updates the address, so the
 * page recounts the people and redraws the preview. Picking another email
 * loads its suggested audience.
 */
export function CampaignForm({ audience, counts }: { audience: Audience; counts: { mentor: number; mentee: number; unset: number; all: number } }) {
  const router = useRouter();
  const go = (next: Record<string, string>) => router.replace(`/admin/announcements/new?${new URLSearchParams(next)}`, { scroll: false });
  const change = (key: string, value: string) => go({ ...audienceParams(audience), [key]: value });

  return (
    <div className="flex flex-col gap-5">
      <Field label="Email">
        <select className={fieldClass} value={audience.template} onChange={(e) => go({ template: e.target.value })}>
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <p className="mt-1.5 text-xs text-ink-3">{TEMPLATES.find((t) => t.id === audience.template)?.about}</p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role">
          <select className={fieldClass} value={audience.role} onChange={(e) => change("role", e.target.value)}>
            <option value="all">Everyone ({counts.all})</option>
            <option value="mentor">Mentors, 4+ years ({counts.mentor})</option>
            <option value="mentee">Mentees, under 4 ({counts.mentee})</option>
            <option value="unset">Profile not set up ({counts.unset})</option>
          </select>
        </Field>
        <Field label="Card">
          <select className={fieldClass} value={audience.card} onChange={(e) => change("card", e.target.value)}>
            <option value="all">Any card</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="unpublished">Unpublished</option>
            <option value="none">No card yet</option>
          </select>
        </Field>
        <Field label="Last logged in">
          <select className={fieldClass} value={audience.inactiveDays ?? ""} onChange={(e) => change("inactive", e.target.value)}>
            <option value="">Any time</option>
            {INACTIVE_DAYS.map((d) => <option key={d} value={d}>More than {d} days ago</option>)}
          </select>
        </Field>
        <Field label="Already had this email">
          <select className={fieldClass} value={audience.resendDays ?? ""} onChange={(e) => change("resend", e.target.value)}>
            <option value="">Never send it twice</option>
            {RESEND_DAYS.map((d) => <option key={d} value={d}>Send again after {d} days</option>)}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Check checked={audience.noPhoto} onChange={(v) => change("photo", v ? "none" : "any")}>No photo on their card</Check>
        <Check checked={audience.under80} onChange={(v) => change("under80", v ? "1" : "0")}>Profile under 80%</Check>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {children}
    </label>
  );
}

/** Send the email to yourself first. */
export function CampaignTestButton({ template }: { template: string }) {
  const [state, action, pending] = useActionState(sendCampaignTest.bind(null, template), {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button type="submit" variant="secondary" loading={pending}>Send a test to me</Button>
      {state.ok && <p className="text-xs text-success">{state.ok}</p>}
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

/** Send to everyone the filters match, one paced batch per click. */
export function CampaignSendButton({ audience, count, label }: { audience: Audience; count: number; label: string }) {
  const [state, action, pending] = useActionState(sendCampaign.bind(null, audienceParams(audience)), {});
  const left = state.remaining ?? count;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!state.sent && !confirm(`Send "${label}" to ${left} ${left === 1 ? "person" : "people"}?`)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <Button type="submit" loading={pending} disabled={left === 0}>
        {left === 0 ? "Nobody to send to" : state.sent ? `Send to the other ${left}` : `Send to ${left} ${left === 1 ? "person" : "people"}`}
      </Button>
      {state.sent !== undefined && (
        <p className="text-xs text-ink-2">
          Sent {state.sent}
          {state.failed ? `, ${state.failed} failed` : ""}. {left} left.
        </p>
      )}
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
