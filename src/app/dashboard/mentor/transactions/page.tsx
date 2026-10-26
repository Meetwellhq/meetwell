import type { Metadata } from "next";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { day, naira, requireMentor, type Activity, type Withdrawal } from "@/lib/mentors/wallet";
import { NotApproved } from "../not-approved";

export const metadata: Metadata = { title: "Transactions" };

const WITHDRAWAL = {
  requested: { tone: "neutral", label: "Waiting for approval" },
  processing: { tone: "accent", label: "On its way" },
  paid: { tone: "success", label: "Paid" },
  failed: { tone: "warning", label: "Failed, money returned" },
  rejected: { tone: "warning", label: "Not approved, money returned" },
} as const;

const ACTIVITY: Record<string, string> = {
  earning: "Subscription from",
  refund: "Refund to",
  withdrawal: "Withdrawal to",
  withdrawal_reversal: "Returned from withdrawal",
  adjustment: "Adjustment",
};

/** Every payment in and out of the mentor's wallet, and their withdrawals. */
export default async function TransactionsPage() {
  const { supabase, approved } = await requireMentor();
  const [{ data: withdrawalRows }, { data: activityRows }] = await Promise.all([supabase.rpc("my_withdrawals"), supabase.rpc("my_wallet_activity")]);
  const withdrawals = (withdrawalRows ?? []) as Withdrawal[];
  const activity = (activityRows ?? []) as Activity[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Transactions</h1>
        <p className="mt-1 text-ink-2">Subscriptions, refunds and withdrawals, newest first.</p>
      </div>

      {!approved ? (
        <NotApproved what="transactions page" />
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 font-semibold">Activity</h2>
            {activity.length === 0 ? (
              <EmptyState title="Nothing yet" description="When a member subscribes to you, the payment shows up here." />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {ACTIVITY[a.kind] ?? a.kind} {a.detail}
                      </p>
                      <p className="text-xs text-ink-3">
                        {day(a.created_at)}
                        {a.kind === "earning" && new Date(a.available_at) > new Date() && <> · available {day(a.available_at)}</>}
                      </p>
                    </div>
                    <p className={`shrink-0 font-medium tabular-nums ${a.amount_kobo < 0 ? "text-ink-2" : "text-ink"}`}>
                      {a.amount_kobo > 0 ? "+" : "−"}
                      {naira(Math.abs(a.amount_kobo))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {withdrawals.length > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 font-semibold">Withdrawals</h2>
              <ul className="divide-y divide-border">
                {withdrawals.map((x) => {
                  const b = WITHDRAWAL[x.status as keyof typeof WITHDRAWAL] ?? WITHDRAWAL.requested;
                  return (
                    <li key={x.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium tabular-nums text-ink">{naira(x.amount_kobo)}</p>
                        <p className="text-xs text-ink-3">
                          {x.bank_name} ••{x.account_last4} · {day(x.created_at)}
                          {x.note && <> · {x.note}</>}
                        </p>
                      </div>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
