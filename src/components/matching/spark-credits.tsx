"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { buyCredits } from "@/lib/payments/actions";

export type CreditPack = { id: string; credits: number; amount_kobo: number };

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);

function BuyButton({ pack, primary }: { pack: CreditPack; primary: boolean }) {
  const [state, action, pending] = useActionState(buyCredits, {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="pack" value={pack.id} />
      <Button type="submit" variant={primary ? "primary" : "secondary"} loading={pending} className="w-full">
        Buy for {naira(pack.amount_kobo)}
      </Button>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

/** Credit balance and packs on the Spark page (members under 4 years). */
export function SparkCredits({ balance, packs, freeLeft }: { balance: number; packs: CreditPack[]; freeLeft: number }) {
  const perCredit = (p: CreditPack) => p.amount_kobo / p.credits;
  const dearest = Math.max(...packs.map(perCredit));

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-4 rounded-lg bg-accent-soft px-4 py-3">
        <div>
          <p className="text-sm text-ink-2">Your credits</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">{balance}</p>
        </div>
        <p className="max-w-[14rem] text-right text-sm text-ink-2">
          {balance === 0
            ? "No credits yet."
            : freeLeft > 0
              ? "Used after your free introductions run out this month."
              : `Spark is using these now. ${balance} more introduction${balance === 1 ? "" : "s"} to come.`}
        </p>
      </div>
      <p className="mt-4 font-medium text-ink">{freeLeft === 0 ? "Get more introductions" : "Want more introductions?"}</p>
      <p className="mt-1 text-sm text-ink-2">
        Each credit gives you one extra introduction after your 5 free ones. Still one a day at most. Credits never
        expire.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {packs.map((p, i) => {
          const saving = Math.round((1 - perCredit(p) / dearest) * 100);
          return (
            <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-semibold text-ink">{p.credits} credits</p>
                {saving > 0 && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    Save {saving}%
                  </span>
                )}
              </div>
              <BuyButton pack={p} primary={i === packs.length - 1} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Payments are handled by Paystack. We never see your card details.{" "}
        <Link href="/dashboard/settings#payments" className="underline">
          See your payment history
        </Link>
        .
      </p>
    </section>
  );
}
