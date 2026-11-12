import type { Metadata } from "next";
import Link from "next/link";
import { PayoutAccountForm, WithdrawForm } from "@/components/mentors/mentor-controls";
import { Card } from "@/components/ui/misc";
import { listBanks } from "@/lib/payments/paystack";
import { day, naira, requireMentor, type Wallet } from "@/lib/mentors/wallet";
import { NotApproved } from "../not-approved";

export const metadata: Metadata = { title: "Wallet" };

/** What the mentor has earned, withdrawing it, and the bank account it goes to. */
export default async function WalletPage() {
  const { supabase, approved } = await requireMentor();
  const [{ data }, banks] = await Promise.all([supabase.rpc("my_wallet"), approved ? listBanks() : Promise.resolve([])]);
  const w = ((data ?? []) as Wallet[])[0];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Wallet</h1>
        <p className="mt-1 text-ink-2">Your 80% of every subscription, ready to withdraw 7 days after each payment.</p>
      </div>

      {!approved || !w ? (
        <NotApproved what="wallet" />
      ) : (
        <>
          <Card className="flex flex-col gap-5 p-5 sm:p-6">
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent-soft p-4">
                <dt className="text-sm text-ink-2">Available</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{naira(w.available_kobo)}</dd>
              </div>
              <div className="rounded-lg bg-surface-2 p-4">
                <dt className="text-sm text-ink-2">Pending</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{naira(w.pending_kobo)}</dd>
                {w.next_release && <dd className="mt-0.5 text-xs text-ink-3">Next ready on {day(w.next_release)}</dd>}
              </div>
            </dl>
            <p className="text-sm text-ink-2">
              Earned so far: {naira(w.earned_kobo)} · withdrawn {naira(w.withdrawn_kobo)}.{" "}
              <Link href="/dashboard/mentor/transactions" className="font-medium text-accent hover:underline">
                See transactions
              </Link>
            </p>
            <WithdrawForm availableKobo={w.available_kobo} canWithdraw={!!w.bank_name} />
          </Card>

          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold">Bank account</h2>
              <p className="mt-1 text-sm text-ink-2">
                Where your withdrawals go. We check the name with your bank and keep only the last 4 digits.
              </p>
            </div>
            {w.bank_name && (
              <p className="text-ink">
                {w.account_name} · {w.bank_name} ••{w.account_last4}
              </p>
            )}
            <PayoutAccountForm banks={banks} hasAccount={!!w.bank_name} />
          </Card>
        </>
      )}
    </div>
  );
}
