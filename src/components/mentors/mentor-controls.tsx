"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { Bank } from "@/lib/payments/paystack";
import { applyAsMentor, lookUpAccount, requestWithdrawal, saveMentorOffer, savePayoutAccount } from "@/lib/mentors/actions";

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export function ApplyButton({ ready }: { ready: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={!ready}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await applyAsMentor();
          if (res.error) toast(res.error, "error");
          else {
            toast("Application sent. We'll email you.");
            router.refresh();
          }
        })
      }
    >
      Apply to be a mentor
    </Button>
  );
}

/** Monthly price and whether new members can subscribe. */
export function OfferForm({ priceKobo, accepting }: { priceKobo: number; accepting: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [free, setFree] = useState(priceKobo === 0);
  const [price, setPrice] = useState(String(priceKobo === 0 ? 5000 : priceKobo / 100));
  const [on, setOn] = useState(accepting);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const value = Number(price) || 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-ink">Take messages</p>
          <p className="mt-0.5 text-sm text-ink-2">When this is on, your card shows a Message button.</p>
        </div>
        <Switch checked={on} onChange={setOn} label="Take messages" showState={false} />
      </div>
      <div className="inline-flex w-fit rounded-full bg-surface-2 p-1" role="radiogroup" aria-label="Price">
        {[
          { value: true, label: "Free" },
          { value: false, label: "Paid" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={free === o.value}
            onClick={() => setFree(o.value)}
            className={`rounded-full px-4 py-1.5 text-sm ${free === o.value ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {free ? (
        <p className="text-sm text-ink-2">
          Members can message you for free. A good way to start mentoring and build a reputation. You can switch to paid
          anytime; open conversations keep their 30 days.
        </p>
      ) : (
        <Field label="Price for 30 days (naira)" hint={`Between ₦2,000 and ₦20,000. You get 80%: ${naira(Math.round(value * 0.8))} per member.`} error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={2000}
              max={20000}
              step={100}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              className="max-w-48"
            />
          )}
        </Field>
      )}
      <div>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await saveMentorOffer(value, on, free);
              setError(res.error ?? null);
              if (!res.error) {
                toast("Saved.");
                router.refresh();
              }
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/** Add or change the bank account withdrawals go to. Paystack checks the name first. */
export function PayoutAccountForm({ banks, hasAccount }: { banks: Bank[]; hasAccount: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(!hasAccount);
  const [bank, setBank] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Change account
      </Button>
    );
  }
  if (banks.length === 0) {
    return <Alert>Bank accounts can be added once withdrawals open.</Alert>;
  }

  const bankName = banks.find((b) => b.code === bank)?.name ?? "";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bank">
          {({ id }) => (
            <Select
              id={id}
              value={bank}
              onChange={(e) => {
                setBank(e.target.value);
                setName(null);
              }}
            >
              <option value="">Choose your bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Account number">
          {({ id }) => (
            <Input
              id={id}
              inputMode="numeric"
              maxLength={10}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value.replace(/\D/g, ""));
                setName(null);
              }}
              placeholder="10 digits"
            />
          )}
        </Field>
      </div>
      {name && (
        <Alert tone="success">
          Account name: <strong>{name}</strong>. Is that you?
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        {name ? (
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await savePayoutAccount(bank, bankName, number);
                setError(res.error ?? null);
                if (!res.error) {
                  toast("Bank account saved.");
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            Yes, use this account
          </Button>
        ) : (
          <Button
            loading={pending}
            disabled={!bank || number.length !== 10}
            onClick={() =>
              start(async () => {
                const res = await lookUpAccount(bank, number);
                setError(res.error ?? null);
                setName(res.message ?? null);
              })
            }
          >
            Check account
          </Button>
        )}
        {hasAccount && (
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export function WithdrawForm({ availableKobo, canWithdraw }: { availableKobo: number; canWithdraw: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const available = Math.floor(availableKobo / 100);
  const [amount, setAmount] = useState(String(Math.max(available, 0)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const enough = available >= 5000;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Amount to withdraw (naira)" hint="At least ₦5,000. We approve withdrawals within 1–2 working days.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={5000}
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby={describedBy}
              disabled={!enough || !canWithdraw}
              className="max-w-48"
            />
          )}
        </Field>
        <Button
          disabled={!enough || !canWithdraw}
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await requestWithdrawal(Number(amount) || 0);
              setError(res.error ?? null);
              if (!res.error) {
                toast("Withdrawal requested.");
                router.refresh();
              }
            })
          }
        >
          Withdraw
        </Button>
      </div>
      {!canWithdraw && <p className="text-sm text-ink-2">Add a bank account below to withdraw.</p>}
      {canWithdraw && !enough && <p className="text-sm text-ink-2">You can withdraw once you have ₦5,000 available.</p>}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
