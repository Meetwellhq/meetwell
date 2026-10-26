import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { AccountMenu, DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DeviceCardsImporter } from "@/components/dashboard/device-cards-importer";
import { ExperiencePrompt } from "@/components/matching/experience-prompt";
import { InstallApp } from "@/components/pwa/install-app";
import { isMentor } from "@/lib/matching/constants";
import { isSparkOn } from "@/lib/spark";
import { Logo } from "@/components/marketing/logo";
import { ThemeMenu } from "@/components/ui/theme-toggle";
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
    <div className="flex flex-1 flex-col bg-surface">
      {/* Full width, edge to edge, and stays at the top; the phone menu drops down under it. */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        {/* h-15 (60px): the sidebar sticks just under it (see the navs). */}
        <div className="relative flex h-15 items-center justify-between gap-4 px-4 sm:px-5">
          <Logo large />
          <div className="flex items-center gap-2">
            {/* Laptops and up: the theme button, then the avatar and its menu. Phones and tablets: the menu button. */}
            <ThemeMenu className="hidden lg:block" />
            <AccountMenu me={{ name, email: user.email ?? null, avatarUrl: profile?.avatar_url ?? null }} className="hidden lg:block" />
            <DashboardNav placement="menu" {...nav} />
          </div>
        </div>
      </header>

      {/* The sidebar runs down the left edge; the page fills the rest. */}
      <div className="flex flex-1">
        <DashboardNav placement="sidebar" {...nav} />
        {/* Cards in the dashboard are 12px round (Card reads --card-radius). */}
        <main className="flex min-w-0 flex-1 flex-col gap-4 bg-surface p-4 sm:p-6 lg:p-8" style={{ "--card-radius": "0.75rem" } as CSSProperties}>
          <InstallApp variant="banner" />
          <div>{children}</div>
        </main>
      </div>
      {profile && profile.experience_years === null && <ExperiencePrompt initialField={profile.field} spark={spark} />}
      <DeviceCardsImporter />
    </div>
  );
}
