import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/editor/profile-editor";
import { Logo } from "@/components/marketing/logo";
import { getSiteUrl } from "@/lib/config";
import { getOwnProfile } from "@/lib/profiles/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your card" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/onboarding");
  // Admin accounts don't have a card.
  const { data: isAdmin } = await (await createClient()).rpc("is_admin");
  if (isAdmin === true) redirect("/admin");
  const profile = await getOwnProfile();
  if (profile?.publishedAt) redirect("/dashboard");
  // Spark details live on the profile row but outside the card editor.
  const { data: spark } = profile
    ? await (await createClient()).from("profiles").select("field, experience_years").eq("id", profile.id).maybeSingle()
    : { data: null };

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-sm text-ink-3">Drafts save as you go</span>
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:py-14">
        <ProfileEditor
          mode="onboarding"
          initial={profile}
          userId={user.id}
          email={user.email}
          siteHost={getSiteUrl().replace(/^https?:\/\//, "")}
          initialExperience={{ field: spark?.field ?? "", experienceYears: spark?.experience_years?.toString() ?? "" }}
        />
      </main>
    </>
  );
}
