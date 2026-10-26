import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DeviceCardsImporter } from "@/components/dashboard/device-cards-importer";
import { ExperiencePrompt } from "@/components/matching/experience-prompt";
import { InstallApp } from "@/components/pwa/install-app";
import { isMentor } from "@/lib/matching/constants";
import { isSparkOn } from "@/lib/spark";
import { Logo } from "@/components/marketing/logo";
import { Avatar } from "@/components/ui/avatar";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dashboard");
  const supabase = await createClient();
  const [{ data: isAdmin }, { data: profile }, conversations, unread, partners, spark] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.from("profiles").select("field, experience_years, full_name, avatar_url").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("my_conversations"),
    supabase.rpc("my_unread_messages"),
    supabase.rpc("my_partners"),
    isSparkOn(),
  ]);
  const messages = (conversations.data ?? []).length > 0 ? { unread: Number(unread.data ?? 0) } : null;
  // Admin accounts are only for running Meetwell: they live in /admin, not here.
  if (isAdmin === true) redirect("/admin");

  const name = profile?.full_name?.trim() || user.email || "You";
  const nav = { messages, mentor: isMentor(profile?.experience_years), partner: (partners.data ?? []).length > 0, spark };

  return (
    <div className="flex flex-1 flex-col bg-surface-2/60">
      {/* Full width, edge to edge; relative: the phone menu drops down under it. */}
      <header className="border-b border-border bg-surface">
        <div className="relative flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
          <Logo large />
          <div className="flex items-center gap-2">
            {/* Phones show only the menu button here. */}
            <div className="hidden items-center gap-3 sm:flex">
              <Avatar name={name} src={profile?.avatar_url} className="size-8 text-xs" />
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="max-w-[14rem] truncate text-sm font-medium text-ink">{name}</span>
                <span className="max-w-[14rem] truncate text-xs text-ink-3">{user.email}</span>
              </span>
            </div>
            <DashboardNav placement="menu" {...nav} />
          </div>
        </div>
      </header>

      {/* The sidebar runs down the left edge; the page sits in its card beside it. */}
      <div className="flex flex-1">
        <DashboardNav placement="sidebar" {...nav} />
        <div className="flex min-w-0 flex-1 flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
          <InstallApp variant="banner" />
          <main className="mx-auto w-full max-w-6xl min-w-0 rounded-2xl bg-surface p-4 sm:p-6">{children}</main>
        </div>
      </div>
      {profile && profile.experience_years === null && <ExperiencePrompt initialField={profile.field} spark={spark} />}
      <DeviceCardsImporter />
    </div>
  );
}
