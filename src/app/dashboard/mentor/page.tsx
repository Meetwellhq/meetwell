import { Check, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplyButton, OfferForm, PayoutAccountForm, WithdrawForm } from "@/components/mentors/mentor-controls";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { publicProfilePath, SUPPORT_EMAIL } from "@/lib/config";
import { isMentor } from "@/lib/matching/constants";
import { listBanks } from "@/lib/payments/paystack";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mentoring" };

type Status = {
  status: "applied" | "approved" | "rejected" | "paused" | null;
  price_kobo: number | null;
  accepting: boolean | null;
  checks: Record<string, boolean>;
  active_subscribers: number | null;
};
type Wallet = {
  available_kobo: number;
  pending_kobo: number;
  next_release: string | null;
  earned_kobo: number;
  withdrawn_kobo: number;
  bank_name: string | null;
  account_last4: string | null;
  account_name: string | null;
};
type Withdrawal = { id: number; amount_kobo: number; status: string; bank_name: string; account_last4: string; created_at: string; note: string | null };
type Activity = { kind: string; amount_kobo: number; available_at: string; created_at: string; detail: string | null };

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

const CHECKS: { key: string; label: string; where: string }[] = [
  { key: "years", label: "4 or more years of experience", where: "/dashboard/profile" },
  { key: "photo", label: "A profile photo", where: "/dashboard/profile" },
  { key: "complete", label: "Profile at least 80% complete", where: "/dashboard/matches" },
  { key: "published", label: "Card published", where: "/dashboard/profile" },
  { key: "confirmed", label: "Email confirmed", where: "/dashboard/settings" },
  { key: "account_age", label: "On Meetwell for at least 14 days", where: "" },
];

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

export default async function MentorPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("slug, experience_years").eq("user_id", user!.id).maybeSingle();
  if (!isMentor(profile?.experience_years)) redirect("/dashboard/matches");

  const [{ data: statusRows }, { data: walletRows }, { data: withdrawals }, { data: activity }] = await Promise.all([
    supabase.rpc("my_mentor_status"),
    supabase.rpc("my_wallet"),
    supabase.rpc("my_withdrawals"),
    supabase.rpc("my_wallet_activity"),
  ]);
  const s = ((statusRows ?? []) as Status[])[0] ?? { status: null, price_kobo: null, accepting: null, checks: {}, active_subscribers: 0 };
  const w = ((walletRows ?? []) as Wallet[])[0];
  const ready = CHECKS.every((c) => s.checks?.[c.key]);
  const approved = s.status === "approved" || s.status === "paused";
  const banks = approved ? await listBanks() : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Mentoring</h1>
        <p className="mt-1 text-ink-2">
          Members earlier in their careers can pay to message you for 30 days. You set the price and keep 80%.
        </p>
      </div>

      {(s.status === null || s.status === "rejected") && (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">{s.status === "rejected" ? "Apply again" : "Become a mentor"}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {s.status === "rejected"
                ? "Your last application wasn't approved. You can apply again when you're ready."
                : "Once these are done, apply and we'll review your card, usually within a few days."}
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {CHECKS.map((c) => {
              const done = !!s.checks?.[c.key];
              return (
                <li key={c.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-ink">
                    {done ? <Check className="size-4 text-accent" aria-hidden /> : <Circle className="size-4 text-ink-3" aria-hidden />}
                    {c.label}
                    <span className="sr-only">{done ? "(done)" : "(to do)"}</span>
                  </span>
                  {!done && c.where && (
                    <Link href={c.where} className="shrink-0 font-medium text-accent hover:underline">
                      Fix
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div>
            <ApplyButton ready={ready} />
          </div>
        </Card>
      )}

      {s.status === "applied" && (
        <Alert>Thanks for applying. We&apos;re reviewing your card and will email you soon.</Alert>
      )}
      {s.status === "paused" && (
        <Alert tone="danger">
          Your mentoring is paused, so new members can&apos;t subscribe. Questions? Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </Alert>
      )}

      {s.status === "approved" && (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Your offer</h2>
            <p className="text-sm text-ink-2">{s.active_subscribers ?? 0} active subscribers</p>
          </div>
          <OfferForm priceKobo={s.price_kobo ?? 500000} accepting={s.accepting ?? true} />
          {profile?.slug && (
            <p className="text-sm text-ink-3">
              See it on{" "}
              <a href={publicProfilePath(profile.slug)} target="_blank" rel="noopener" className="text-accent underline">
                your card
              </a>
              . Please reply to new members within 7 days, or they get a full refund.
            </p>
          )}
        </Card>
      )}

      {approved && w && (
        <>
          <Card className="flex flex-col gap-5 p-5 sm:p-6">
            <h2 className="font-semibold">Wallet</h2>
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
              Earnings become available 7 days after each payment. Earned so far: {naira(w.earned_kobo)} · withdrawn{" "}
              {naira(w.withdrawn_kobo)}.
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

          {((withdrawals ?? []) as Withdrawal[]).length > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 font-semibold">Withdrawals</h2>
              <ul className="divide-y divide-border">
                {((withdrawals ?? []) as Withdrawal[]).map((x) => {
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

          {((activity ?? []) as Activity[]).length > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 font-semibold">Activity</h2>
              <ul className="divide-y divide-border text-sm">
                {((activity ?? []) as Activity[]).map((a, i) => (
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
            </Card>
          )}
        </>
      )}
    </div>
  );
}
