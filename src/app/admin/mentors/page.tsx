import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { date, naira, NotReady, PageTitle, Stats } from "@/components/admin/admin-ui";
import { MentorDecision, RefundButton, WithdrawalActions } from "@/components/admin/mentor-admin";
import { Badge, EmptyState } from "@/components/ui/misc";
import { publicProfilePath } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mentors · Admin" };

type Mentor = {
  email: string;
  full_name: string | null;
  slug: string | null;
  experience_years: number | null;
  status: "applied" | "approved" | "rejected" | "paused";
  price_kobo: number;
  accepting: boolean;
  checks: Record<string, boolean>;
  applied_at: string;
  active_subscribers: number;
  earned_kobo: number;
  available_kobo: number;
  pending_kobo: number;
};
type Withdrawal = {
  id: number;
  email: string;
  full_name: string | null;
  amount_kobo: number;
  status: string;
  bank_name: string;
  account_last4: string;
  account_name: string;
  created_at: string;
  note: string | null;
};
type Sub = {
  reference: string;
  member_email: string;
  mentor_email: string;
  amount_kobo: number;
  mentor_share_kobo: number;
  status: "success" | "refunded";
  paid_at: string;
  access_until: string | null;
  mentor_replied: boolean;
  refund_due: boolean;
};

const STATUS = {
  applied: { tone: "warning", label: "Applied" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "neutral", label: "Not approved" },
  paused: { tone: "warning", label: "Paused" },
} as const;

const W_STATUS: Record<string, { tone: "neutral" | "accent" | "success" | "warning"; label: string }> = {
  requested: { tone: "warning", label: "Needs approval" },
  processing: { tone: "accent", label: "Sending" },
  paid: { tone: "success", label: "Paid" },
  failed: { tone: "warning", label: "Failed" },
  rejected: { tone: "neutral", label: "Rejected" },
};

export default async function AdminMentorsPage() {
  const supabase = await createClient();
  const [mentors, withdrawals, subs] = await Promise.all([
    supabase.rpc("admin_list_mentors"),
    supabase.rpc("admin_list_withdrawals"),
    supabase.rpc("admin_list_subscriptions"),
  ]);
  if (mentors.error) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle title="Mentors">Mentor applications, subscriptions and withdrawals.</PageTitle>
        <NotReady what="Mentors" />
      </div>
    );
  }
  const ms = (mentors.data ?? []) as Mentor[];
  const ws = (withdrawals.data ?? []) as Withdrawal[];
  const ss = (subs.data ?? []) as Sub[];
  const toApprove = ws.filter((w) => w.status === "requested");
  const paid = ss.filter((s) => s.status === "success");

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Mentors">
        Approve mentors, check subscriptions and refunds, and send withdrawals. Mentors keep 80%; Meetwell keeps 20%.
      </PageTitle>

      <Stats
        items={[
          { label: "Approved mentors", value: ms.filter((m) => m.status === "approved").length },
          { label: "Waiting for approval", value: ms.filter((m) => m.status === "applied").length },
          { label: "Subscriptions paid", value: paid.length, note: naira(paid.reduce((n, s) => n + s.amount_kobo, 0)) + " in total" },
          { label: "Withdrawals to approve", value: toApprove.length, note: naira(toApprove.reduce((n, w) => n + w.amount_kobo, 0)) },
        ]}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Withdrawals</h2>
        {ws.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState title="No withdrawals yet" description="When a mentor asks to withdraw, it shows here for you to approve." />
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {ws.map((w) => {
              const b = W_STATUS[w.status] ?? W_STATUS.requested;
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums text-ink">
                      {naira(w.amount_kobo)} to {w.full_name || w.email}
                    </p>
                    <p className="text-sm text-ink-2">
                      {w.account_name} · {w.bank_name} ••{w.account_last4}
                    </p>
                    <p className="text-xs text-ink-3">
                      {w.email} · asked {date(w.created_at)}
                      {w.note && <> · {w.note}</>}
                    </p>
                  </div>
                  {w.status === "requested" ? (
                    <WithdrawalActions id={w.id} amount={naira(w.amount_kobo)} to={`${w.account_name} (${w.bank_name} ••${w.account_last4})`} />
                  ) : (
                    <Badge tone={b.tone}>{b.label}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-ink-3">
          Check the account name matches the mentor before sending. Paystack charges a small fee per transfer, paid by
          Meetwell.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Mentors</h2>
        {ms.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState title="No applications yet" description="Members with 4+ years can apply from their Mentoring page." />
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {ms.map((m) => {
              const st = STATUS[m.status];
              const missing = Object.entries(m.checks ?? {}).filter(([, ok]) => !ok).map(([k]) => k);
              return (
                <li key={m.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      {m.full_name || m.email} <Badge tone={st.tone}>{st.label}</Badge>
                    </p>
                    <p className="text-sm text-ink-2">
                      {m.experience_years ?? "?"} years · {naira(m.price_kobo)}/30 days{m.accepting ? "" : " · not taking messages"} ·{" "}
                      {m.active_subscribers} active
                    </p>
                    <p className="text-xs text-ink-3">
                      {m.email} · applied {date(m.applied_at)} · earned {naira(m.earned_kobo)} · available {naira(m.available_kobo)}
                      {missing.length > 0 && <> · missing: {missing.join(", ")}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.slug && (
                      <a href={publicProfilePath(m.slug)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                        Card <ArrowUpRight className="size-3.5" aria-hidden />
                      </a>
                    )}
                    <MentorDecision email={m.email} status={m.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Subscriptions</h2>
        {ss.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState title="No subscriptions yet" description="Paid 30-day subscriptions show here." />
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {ss.map((s) => (
              <li key={s.reference} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {s.member_email} → {s.mentor_email}
                  </p>
                  <p className="text-xs text-ink-3">
                    {naira(s.amount_kobo)} (mentor {naira(s.mentor_share_kobo)}) · paid {date(s.paid_at)}
                    {s.access_until && <> · until {date(s.access_until)}</>} · {s.mentor_replied ? "mentor replied" : "no reply yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.status === "refunded" ? (
                    <Badge>Refunded</Badge>
                  ) : (
                    <>
                      {s.refund_due && <Badge tone="warning">No reply in 7 days</Badge>}
                      <RefundButton reference={s.reference} amount={naira(s.amount_kobo)} member={s.member_email} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
