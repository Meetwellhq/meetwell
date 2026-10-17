import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Logo } from "@/components/marketing/logo";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <Logo href="/dashboard" />
            <div className="flex items-center gap-3">
              <span className="hidden max-w-[16rem] truncate text-sm text-ink-3 sm:inline">{user.email}</span>
              <form action={signOut}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <DashboardNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </>
  );
}
