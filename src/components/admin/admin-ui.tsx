import type { ReactNode } from "react";
import { Badge } from "@/components/ui/misc";

/** Shared bits for the admin pages. */

export type Reminder = { kind: keyof typeof REMINDER_LABEL; sent_at: string };

export type WaitlistRow = {
  email: string;
  full_name: string | null;
  joined_at: string;
  invited_at: string | null;
  signed_up: boolean;
  reminders?: Reminder[];
};

export type MemberRow = {
  email: string;
  joined_at: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  full_name: string | null;
  slug: string | null;
  card_status: "draft" | "published" | "unpublished" | null;
  has_photo: boolean;
  views: number;
  qr_scans: number;
  contacts_saved: number;
  reminders?: Reminder[];
};

export type PaymentRow = {
  email: string;
  reference: string;
  credits: number;
  amount_kobo: number;
  status: "pending" | "success" | "failed";
  created_at: string;
  paid_at: string | null;
};

/** Counts come back from Postgres as strings; make them numbers. */
export const toMembers = (rows: unknown) =>
  ((rows ?? []) as MemberRow[]).map((m) => ({
    ...m,
    views: Number(m.views),
    qr_scans: Number(m.qr_scans),
    contacts_saved: Number(m.contacts_saved),
  }));

export const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);

export const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

/** "Active" = logged in during the last 30 days. */
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export function isActive(lastSignIn: string | null) {
  return !!lastSignIn && Date.now() - new Date(lastSignIn).getTime() < ACTIVE_WINDOW_MS;
}

/** Automatic one-time reminders (see the daily job in /api/cron/reminders). */
const REMINDER_LABEL = {
  invite_unused: "Invite reminder sent",
  email_unconfirmed: "Confirmation re-sent",
  card_draft: "Finish-card reminder sent",
  no_scans: "QR tip sent",
  profile_incomplete: "Profile reminder sent",
} as const;

export function ReminderBadges({ reminders }: { reminders?: Reminder[] }) {
  return (reminders ?? []).map((r) => (
    <Badge key={r.kind} tone="accent">
      {REMINDER_LABEL[r.kind] ?? "Reminder sent"} {date(r.sent_at)}
    </Badge>
  ));
}

export function Stats({ items, columns = 4 }: { items: { label: string; value: ReactNode }[]; columns?: 3 | 4 }) {
  return (
    <dl className={`grid grid-cols-2 gap-3 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
      {items.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-sm text-ink-2">{s.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageTitle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-ink-2">{children}</p>
    </div>
  );
}

/** Shown when a section's SQL hasn't been run in Supabase yet. */
export function NotReady({ what }: { what: string }) {
  return (
    <p className="rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-ink-2">
      {what} can&apos;t be loaded yet. Run its SQL in Supabase first.
    </p>
  );
}
