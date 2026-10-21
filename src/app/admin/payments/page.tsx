import type { Metadata } from "next";
import { date, naira, NotReady, PageTitle, type PaymentRow, Stats } from "@/components/admin/admin-ui";
import { Badge, EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payments · Admin" };

const PAYMENT_BADGE = {
  success: { tone: "success", label: "Paid" },
  pending: { tone: "neutral", label: "Not finished" },
  failed: { tone: "warning", label: "Failed" },
} as const;

export default async function AdminPaymentsPage() {
  const { data, error } = await (await createClient()).rpc("admin_list_payments");
  const payments = (data ?? []) as PaymentRow[];
  const paid = payments.filter((p) => p.status === "success");

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Payments">Spark credit purchases through Paystack. Refunds are done in the Paystack dashboard.</PageTitle>
      {error ? (
        <NotReady what="Payments" />
      ) : (
        <>
          <Stats
            columns={3}
            items={[
              { label: "Paid", value: paid.length },
              { label: "Total received", value: naira(paid.reduce((n, p) => n + p.amount_kobo, 0)) },
              { label: "Credits sold", value: paid.reduce((n, p) => n + p.credits, 0) },
            ]}
          />
          {payments.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface">
              <EmptyState title="No payments yet" description="Credit purchases will show up here." />
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {payments.map((p) => (
                <li key={p.reference} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.email}</p>
                    <p className="truncate text-sm text-ink-2">
                      {p.credits} credits · {naira(p.amount_kobo)} · {date(p.paid_at ?? p.created_at)}
                    </p>
                    <p className="truncate text-xs text-ink-3">{p.reference}</p>
                  </div>
                  <Badge tone={PAYMENT_BADGE[p.status].tone}>{PAYMENT_BADGE[p.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
