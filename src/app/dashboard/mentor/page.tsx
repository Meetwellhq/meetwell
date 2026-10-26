import { Check, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ApplyButton, OfferForm } from "@/components/mentors/mentor-controls";
import { buttonClass } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/misc";
import { publicProfilePath, SUPPORT_EMAIL } from "@/lib/config";
import { requireMentor } from "@/lib/mentors/wallet";

export const metadata: Metadata = { title: "Mentoring" };

const CHECKS: { key: string; label: string; where: string }[] = [
  { key: "years", label: "4 or more years of experience", where: "/dashboard/profile" },
  { key: "photo", label: "A profile photo", where: "/dashboard/profile" },
  { key: "complete", label: "Profile at least 80% complete", where: "/dashboard/profile" },
  { key: "published", label: "Card published", where: "/dashboard/profile" },
  { key: "confirmed", label: "Email confirmed", where: "/dashboard/settings" },
];

export default async function MentorPage() {
  const { status: s, slug, approved } = await requireMentor();
  const ready = CHECKS.every((c) => s.checks?.[c.key]);

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
          {slug && (
            <p className="text-sm text-ink-3">
              See it on{" "}
              <a href={publicProfilePath(slug)} target="_blank" rel="noopener" className="text-accent underline">
                your card
              </a>
              . Please reply to new members within 7 days, or they get a full refund.
            </p>
          )}
        </Card>
      )}

      {approved && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Your money</h2>
            <p className="mt-1 text-sm text-ink-2">Your earnings, withdrawals and bank account.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/mentor/wallet" className={buttonClass({ size: "sm" })}>Wallet</Link>
            <Link href="/dashboard/mentor/transactions" className={buttonClass({ size: "sm", variant: "secondary" })}>Transactions</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
