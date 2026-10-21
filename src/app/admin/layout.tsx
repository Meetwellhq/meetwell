import { LogOut } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/marketing/logo";
import { signOut } from "@/lib/auth/actions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

const SECTIONS = [
  { href: "#waitlist", label: "Waiting list" },
  { href: "#announcements", label: "Announcements" },
  { href: "#payments", label: "Payments" },
  { href: "#members", label: "Members" },
];

/**
 * The admin area, for admin accounts only (public.admins). Everyone else gets a
 * plain 404, and every admin database function refuses non-admins as well.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/sign-in");
  const { data: isAdmin } = await (await createClient()).rpc("is_admin");
  if (isAdmin !== true) notFound();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-white">Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden max-w-[16rem] truncate text-sm text-ink-3 sm:inline">{user.email}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  <LogOut className="size-4" aria-hidden />
                  Log out
                </button>
              </form>
            </div>
          </div>
          <nav aria-label="Admin" className="-mb-px flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-ink-2 transition-colors hover:text-ink"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </>
  );
}
