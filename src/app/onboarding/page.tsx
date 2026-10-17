import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/editor/profile-editor";
import { Logo } from "@/components/marketing/logo";
import { getSiteUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your card" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/onboarding");
  const profile = await getOwnProfile();
  if (profile?.publishedAt) redirect("/dashboard");

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/dashboard" />
          <span className="text-sm text-ink-3">Drafts save as you go</span>
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:py-14">
        <ProfileEditor mode="onboarding" initial={profile} userId={user.id} email={user.email} siteHost={getSiteUrl().replace(/^https?:\/\//, "")} />
      </main>
    </>
  );
}
