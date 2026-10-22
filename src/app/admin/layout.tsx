import { LogOut, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AdminNav, type Counts } from "@/components/admin/admin-nav";
import { Logo } from "@/components/marketing/logo";
import { signOut } from "@/lib/auth/actions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * The admin area, for admin accounts only (public.admins). Everyone else gets a
 * plain 404, and every admin database function refuses non-admins as well.
 * Layout: a top bar, a sidebar of sections with counts of things waiting on the
 * admin, and the page.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/sign-in");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();

  const [waitlist, reports, mentors, withdrawals] = await Promise.all([
    supabase.rpc("admin_list_waitlist"),
    supabase.rpc("admin_list_reports"),
    supabase.rpc("admin_list_mentors"),
    supabase.rpc("admin_list_withdrawals"),
  ]);
  const count = <T,>(data: unknown, keep: (row: T) => boolean) => ((data ?? []) as T[]).filter(keep).length;
  const counts: Counts = {
    waiting: count<{ invited_at: string | null; signed_up: boolean }>(waitlist.data, (r) => !r.invited_at && !r.signed_up),
    reports: count<{ status: string }>(reports.data, (r) => r.status === "open"),
    mentors:
      count<{ status: string }>(mentors.data, (r) => r.status === "applied") +
      count<{ status: string }>(withdrawals.data, (r) => r.status === "requested"),
  };

  return (
    <div className="flex-1 bg-surface-2/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <header className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-white">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 rounded-full border border-border py-1.5 pl-1.5 pr-1.5 sm:pr-4">
              <span className="grid size-8 place-items-center rounded-full bg-accent text-white">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-medium text-ink">Meetwell Admin</span>
                <span className="max-w-[14rem] truncate text-xs text-ink-3">{user.email}</span>
              </span>
            </div>
            {/* The sidebar has Log out on large screens; small screens get it here. */}
            <form action={signOut} className="lg:hidden">
              <button type="submit" aria-label="Log out" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
                <LogOut className="size-5" aria-hidden />
              </button>
            </form>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <AdminNav counts={counts} />
          <main className="min-w-0 rounded-2xl bg-surface p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
