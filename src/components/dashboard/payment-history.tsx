import { Badge } from "@/components/ui/misc";

export type PaymentHistoryRow = {
  reference: string;
  kind: "credits" | "subscription";
  credits: number | null;
  days: number | null;
  mentor_name: string | null;
  amount_kobo: number;
  status: "success" | "refunded";
  paid_at: string | null;
};

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

/** What a member paid for, when and how much. */
export function PaymentHistory({ rows }: { rows: PaymentHistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-ink-2">No payments yet.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map((p) => (
        <li key={p.reference} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {p.kind === "credits"
                ? `${p.credits} Spark credits`
                : `${p.days ?? 30} days of messages with ${p.mentor_name ?? "a mentor"}`}
            </p>
            <p className="text-xs text-ink-3">
              {p.paid_at ? when(p.paid_at) : "Date unknown"} · Ref {p.reference.slice(-8).toUpperCase()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {p.status === "refunded" && <Badge>Refunded</Badge>}
            <p className={`font-medium tabular-nums ${p.status === "refunded" ? "text-ink-3 line-through" : "text-ink"}`}>
              {naira(p.amount_kobo)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
