import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { isActive, naira, PageTitle, type PaymentRow, Stats, toMembers, type WaitlistRow } from "@/components/admin/admin-ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const [waitlist, members, paymentRows] = await Promise.all([
    supabase.rpc("admin_list_waitlist"),
    supabase.rpc("admin_list_members"),
    supabase.rpc("admin_list_payments"),
  ]);
  const rows = (waitlist.data ?? []) as WaitlistRow[];
  const people = toMembers(members.data);
  const paid = ((paymentRows.data ?? []) as PaymentRow[]).filter((p) => p.status === "success");

  const sections = [
    { href: "/admin/waitlist", title: "Waiting list", text: `${rows.filter((r) => !r.invited_at).length} waiting for an invite` },
    { href: "/admin/members", title: "Members", text: `${people.length} members, ${people.filter((m) => m.card_status === "published").length} with a live card` },
    { href: "/admin/announcements", title: "Announcements", text: "One-off emails to every member" },
    { href: "/admin/payments", title: "Payments", text: `${paid.length} paid, ${naira(paid.reduce((n, p) => n + p.amount_kobo, 0))} in total` },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Overview">Everything about Meetwell in one place. Only admin accounts can open this page.</PageTitle>
      <Stats
        items={[
          { label: "Members", value: people.length },
          { label: "Cards published", value: people.filter((m) => m.card_status === "published").length },
          { label: "Active in 30 days", value: people.filter((m) => isActive(m.last_sign_in_at)).length },
          { label: "On the waiting list", value: rows.length },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 hover:border-border-strong"
          >
            <div>
              <p className="font-medium text-ink">{s.title}</p>
              <p className="mt-0.5 text-sm text-ink-2">{s.text}</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
